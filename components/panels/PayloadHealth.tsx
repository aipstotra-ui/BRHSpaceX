"use client";

import { useEffect, useState } from "react";

import { PlacementMap, tileLayout } from "@/components/panels/PlacementMap";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { simulateImpact } from "@/lib/engine/impact";
import { GIRGIS_NOTES } from "@/lib/engine/radiation";
import { PEAK_FLAG_TEXT } from "@/lib/engine/thermal";
import { buildHourlyFromFeeds, computeFeatureMap, issueTimeIso, vectorFromMap } from "@/lib/ml/features";
import { calibrateQuantiles, type TargetName } from "@/lib/ml/forecast";
import { runModel } from "@/lib/ml/ort";
import { getPreset } from "@/lib/presets";
import { useShellStore } from "@/lib/store";
import type { SourceLabel } from "@/lib/types";
import modelCard from "@/public/models/model-card.json";

type Phase = "loading" | "error" | "empty" | "ready";

type Band = { p50: number; p90: number };

function Num({
  value,
  digits,
  label,
  unit,
}: {
  value: number;
  digits: number;
  label: SourceLabel;
  unit: string;
}) {
  return (
    <span>
      {value.toFixed(digits)} {unit} <SourceBadge label={label} />
    </span>
  );
}

async function readFeed<T>(feed: string): Promise<T> {
  const response = await fetch(`/api/data/${feed}`);
  if (!response.ok) {
    throw new Error(feed);
  }
  const body = (await response.json()) as { data?: T };
  if (!body.data) {
    throw new Error(feed);
  }
  return body.data;
}

export function PayloadHealth() {
  const presetId = useShellStore((state) => state.presetId);
  const spec = useShellStore((state) => state.spec);
  const payload = useShellStore((state) => state.payload);
  const preset = getPreset(presetId);
  const [phase, setPhase] = useState<Phase>("loading");
  const [stress, setStress] = useState(false);
  const [kp, setKp] = useState<Band | null>(null);
  const [dst, setDst] = useState<Band | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [mag, wind, kpRows, dstRows, f107] = await Promise.all([
          readFeed<{ time_tag: string; bz_gsm: number | null; by_gsm: number | null }[]>("rtsw_mag_1m"),
          readFeed<{ time_tag: string; proton_speed: number; proton_density: number }[]>("rtsw_wind_1m"),
          readFeed<{ time_tag: string; Kp: number }[]>("kp"),
          readFeed<{ time_tag: string; dst: number }[]>("dst"),
          readFeed<{ time_tag: string; flux: number; reporting_schedule: string }[]>("f107"),
        ]);
        const now = new Date();
        const issueIso = issueTimeIso(now);
        const hourly = buildHourlyFromFeeds(now, mag, wind, kpRows, dstRows, f107);
        const map = computeFeatureMap(hourly, issueIso);
        const vector = vectorFromMap(modelCard.feature_names, map);
        const raw = new Map<string, { target: TargetName; p10?: number; p50?: number; p90?: number }>();
        const models = modelCard.models.filter((model) => model.horizon_h === 6);
        for (const model of models) {
          const target = model.target === "dst" ? "dst" : "kp";
          const slot = raw.get(target) ?? { target };
          const value = await runModel(model.file, vector, model.output_name);
          if (model.quantile === 0.1) {
            slot.p10 = value;
          } else if (model.quantile === 0.5) {
            slot.p50 = value;
          } else {
            slot.p90 = value;
          }
          raw.set(target, slot);
        }
        const nextKp = raw.get("kp");
        const nextDst = raw.get("dst");
        if (
          !nextKp ||
          !nextDst ||
          nextKp.p10 === undefined ||
          nextKp.p50 === undefined ||
          nextKp.p90 === undefined ||
          nextDst.p10 === undefined ||
          nextDst.p50 === undefined ||
          nextDst.p90 === undefined
        ) {
          throw new Error("quantile");
        }
        const kpBand = calibrateQuantiles(
          "kp",
          nextKp.p10,
          nextKp.p50,
          nextKp.p90,
          modelCard.calibration.kp_h06,
        );
        const dstBand = calibrateQuantiles(
          "dst",
          nextDst.p10,
          nextDst.p50,
          nextDst.p90,
          modelCard.calibration.dst_h06,
        );
        if (cancelled) {
          return;
        }
        setKp({ p50: kpBand.p50, p90: kpBand.p90 });
        setDst({ p50: dstBand.p50, p90: dstBand.p90 });
        setPhase("ready");
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setPhase("error");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const forecastKp = phase === "ready" && kp ? (stress ? kp.p90 : kp.p50) : 2;
  const sameMemory = spec.memoryCapacity === preset.spec.memoryCapacity;
  const impact = simulateImpact({
    spec,
    payload,
    kp: forecastKp,
    memoryUnit: sameMemory ? preset.memoryUnit : "GB",
    nodeKnown: spec.nodeNm === preset.spec.nodeNm ? preset.nodeKnown : spec.nodeNm > 0,
    deviceSeu: preset.deviceSeu && spec.name === preset.spec.name ? preset.deviceSeu : undefined,
    ratioLabel:
      spec.avgPowerKw === preset.spec.avgPowerKw &&
      payload.radiatorAreaM2 === preset.payload.radiatorAreaM2 &&
      preset.labels.avgPowerKw === "source" &&
      preset.payloadLabels.radiatorAreaM2 === "source"
        ? "source"
        : "estimate",
  });

  const memoryCount = sameMemory ? preset.memoryTiles.count : spec.memoryCapacity > 0 ? 1 : 0;
  const memoryLabel: SourceLabel = sameMemory ? preset.memoryTiles.label : "estimate";
  const memoryNote = sameMemory ? preset.memoryTiles.note : "One memory tile is a grouping estimate.";
  const upsetHeat = Math.max(0, Math.min(0.999, Math.log10(1 + Math.max(0, impact.upsetRate.value)) / 8));
  const eccHeat = impact.upsetRate.value > 0 ? Math.min(0.999, impact.correctable.value / impact.upsetRate.value) : 0;
  const doseHeat =
    impact.tidLimit.value > 0 ? Math.min(0.999, impact.annualDose.value / impact.tidLimit.value) : 0;
  const gpuMap = tileLayout(spec.acceleratorCount, "G", upsetHeat);
  const cpuMap = tileLayout(spec.cpuCount, "C", upsetHeat);
  const memMap = tileLayout(memoryCount, "M", doseHeat);
  const noTiles = spec.acceleratorCount === 0 && spec.cpuCount === 0 && memoryCount === 0;

  return (
    <div data-testid="payload-health">
      <h3 className="heading-md">Thermal</h3>
      <p className="body">
        Average at 320 K <Num value={impact.thermal.areaAvg320.value} digits={1} label="estimate" unit="m²" />
        . Average at 340 K <Num value={impact.thermal.areaAvg340.value} digits={1} label="estimate" unit="m²" />.
        Installed <Num value={payload.radiatorAreaM2} digits={1} label={preset.payload.radiatorAreaM2 === payload.radiatorAreaM2 ? preset.payloadLabels.radiatorAreaM2 : "estimate"} unit="m²" />.
      </p>
      <p className="body">
        Radiator <Num value={impact.thermal.radiatorTemperatureK.value} digits={1} label={impact.thermal.radiatorTemperatureK.label} unit="K" />
        {preset.inletC ? (
          <>
            {" "}
            beside inlet <Num value={preset.inletC.value} digits={0} label={preset.inletC.label} unit="°C" />
          </>
        ) : null}
      </p>
      {impact.thermal.peakFlag ? <p className="body">{PEAK_FLAG_TEXT}</p> : null}
      <p className="body rok-muted">{impact.thermal.assumptions[0]}</p>

      <h3 className="heading-md">Forecast stress</h3>
      {phase === "loading" ? <p className="body rok-muted">Loading</p> : null}
      {phase === "error" ? (
        <p className="body" style={{ color: "var(--status-critical)" }} data-testid="forecast-status">
          Error
        </p>
      ) : null}
      {phase === "empty" ? <p className="body rok-muted">Empty</p> : null}
      {phase === "ready" && kp && dst ? (
        <div data-testid="forecast-status">
          <p className="body">
            Kp +6 h P50 <Num value={kp.p50} digits={2} label="estimate" unit="Kp" />. P90{" "}
            <Num value={kp.p90} digits={2} label="estimate" unit="Kp" />. Dst +6 h P50{" "}
            <Num value={dst.p50} digits={1} label="estimate" unit="nT" />. P90{" "}
            <Num value={dst.p90} digits={1} label="estimate" unit="nT" />.
          </p>
          <button type="button" className="rok-btn" data-testid="stress-toggle" aria-pressed={stress} onClick={() => setStress((value) => !value)}>
            {stress ? "P90 stress" : "P50"}
          </button>
        </div>
      ) : null}
      <p className="body">
        Applied Kp <Num value={forecastKp} digits={2} label="estimate" unit="Kp" />. Storm multiplier{" "}
        <Num value={impact.storm.value} digits={3} label="estimate" unit="1" />.
        {phase !== "ready" ? " Forecast unavailable, so Kp 2 is the quiet snapshot." : " Dst is shown and is not an input to the multiplier."}
      </p>

      <h3 className="heading-md">Environment</h3>
      <p className="body">
        Quiet SAA example <Num value={impact.directionalFlux.value} digits={1} label="source" unit="protons/cm2/s/sr" />. Omnidirectional{" "}
        <Num value={impact.omnidirectionalFlux.value} digits={1} label="estimate" unit="protons/cm2/s" />.
      </p>
      <p className="body">
        Upset rate <Num value={impact.upsetRate.value} digits={3} label="estimate" unit="1/s" />. ECC correctable{" "}
        <Num value={impact.correctable.value} digits={3} label="estimate" unit="1/s" />. Five-year dose anchor{" "}
        <Num value={impact.fiveYearDose.value} digits={0} label="source" unit="rad(Si)" />. Annual{" "}
        <Num value={impact.annualDose.value} digits={2} label="estimate" unit="krad(Si)/yr" />.
      </p>
      <p className="body rok-muted">Drag is flagged only. Orbit-averaged drag is not computed, and no altitude is used.</p>
      <ul>
        {GIRGIS_NOTES.map((note) => (
          <li key={note.text} className="body">
            {note.text} <SourceBadge label={note.label} />
          </li>
        ))}
      </ul>
      {impact.monteCarlo.isEstimate ? (
        <p className="body">
          Upset band <Num value={impact.monteCarlo.upsetLow} digits={3} label="estimate" unit="1/s" /> to{" "}
          <Num value={impact.monteCarlo.upsetHigh} digits={3} label="estimate" unit="1/s" />. Unknown chip parameters only.
        </p>
      ) : null}

      <h3 className="heading-md">Tiles</h3>
      {noTiles ? <p className="body rok-muted">Empty</p> : null}
      {spec.acceleratorCount > 0 ? (
        <div>
          <p className="eyebrow">
            GPUs colored by upset rate <SourceBadge label="estimate" />
          </p>
          <PlacementMap chips={gpuMap.chips} cols={gpuMap.cols} rows={gpuMap.rows} cell={gpuMap.cell} label="GPU upsets" />
        </div>
      ) : null}
      {spec.cpuCount > 0 ? (
        <div>
          <p className="eyebrow">
            CPUs colored by upset rate <SourceBadge label="estimate" />
          </p>
          <PlacementMap chips={cpuMap.chips} cols={cpuMap.cols} rows={cpuMap.rows} cell={cpuMap.cell} label="CPU upsets" />
        </div>
      ) : null}
      {memoryCount > 0 ? (
        <div>
          <p className="eyebrow">
            Memory colored by dose fraction <SourceBadge label={memoryLabel} />
          </p>
          <p className="body-sm rok-muted">{memoryNote}</p>
          <PlacementMap chips={memMap.chips} cols={memMap.cols} rows={memMap.rows} cell={memMap.cell} label="Memory dose" />
        </div>
      ) : null}
      {spec.acceleratorCount > 0 ? (
        <div>
          <p className="eyebrow">
            ECC load <SourceBadge label="estimate" />
          </p>
          <PlacementMap
            chips={tileLayout(spec.acceleratorCount, "E", eccHeat).chips}
            cols={gpuMap.cols}
            rows={gpuMap.rows}
            cell={gpuMap.cell}
            label="ECC load"
          />
        </div>
      ) : null}
    </div>
  );
}
