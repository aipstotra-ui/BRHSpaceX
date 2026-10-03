"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { SourceBadge } from "@/components/ui/SourceBadge";
import { ACTION_ORDER, POLICY_COSTS } from "@/lib/engine/actions";
import { simulateImpact } from "@/lib/engine/impact";
import { PEAK_FLAG_TEXT } from "@/lib/engine/thermal";
import { badgeForField, badgeForPayload, getPreset, PRESETS } from "@/lib/presets";
import { chipSpecSchema } from "@/lib/schemas/chipSpec";
import { useShellStore } from "@/lib/store";
import type { ChipSpec, PayloadConfig, SourceLabel } from "@/lib/types";

type Phase = "loading" | "error" | "empty" | "ready";

const NUMBER_FIELDS: { key: keyof ChipSpec; label: string }[] = [
  { key: "nodeNm", label: "Process node (nm)" },
  { key: "acceleratorCount", label: "Accelerators" },
  { key: "cpuCount", label: "CPUs" },
  { key: "memoryCapacity", label: "Memory capacity" },
  { key: "opTempMinC", label: "Operating temp min (°C)" },
  { key: "opTempMaxC", label: "Operating temp max (°C)" },
  { key: "shieldingMmAl", label: "Shielding (mm Al)" },
];

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

function isEmptySpec(spec: ChipSpec): boolean {
  return spec.memoryCapacity === 0 && spec.avgPowerKw === 0 && spec.acceleratorCount === 0 && spec.cpuCount === 0;
}

export function ChipSpecStudio() {
  const setStudio = useShellStore((state) => state.setStudio);
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [payload, setPayload] = useState<PayloadConfig>(PRESETS[0].payload);
  const [booted, setBooted] = useState(false);
  const preset = getPreset(presetId);
  const form = useForm<ChipSpec>({ defaultValues: preset.spec });
  const watched = useWatch({ control: form.control, defaultValue: preset.spec });
  const watchedKey = JSON.stringify(watched);
  const payloadKey = JSON.stringify(payload);
  const parsed = chipSpecSchema.safeParse(watched);
  const phase: Phase = !booted
    ? "loading"
    : !parsed.success
      ? "error"
      : isEmptySpec(parsed.data)
        ? "empty"
        : "ready";

  useEffect(() => {
    const id = window.setTimeout(() => setBooted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const check = chipSpecSchema.safeParse(JSON.parse(watchedKey) as ChipSpec);
    if (!check.success) {
      return;
    }
    setStudio({
      presetId,
      spec: check.data,
      payload: JSON.parse(payloadKey) as PayloadConfig,
    });
  }, [payloadKey, presetId, setStudio, watchedKey]);

  function applyPreset(id: string) {
    const next = getPreset(id);
    setPresetId(next.id);
    setPayload(next.payload);
    form.reset(next.spec);
  }

  const spec = parsed.success ? parsed.data : preset.spec;
  const ai1 = presetId === "ai1-spacex" || presetId === "ai1-alternate";
  const ratioLabel =
    spec.avgPowerKw === preset.spec.avgPowerKw &&
    payload.radiatorAreaM2 === preset.payload.radiatorAreaM2 &&
    preset.labels.avgPowerKw === "source" &&
    preset.payloadLabels.radiatorAreaM2 === "source"
      ? "source"
      : "estimate";
  const impact = simulateImpact({
    spec,
    payload,
    kp: 2,
    memoryUnit: spec.memoryCapacity === preset.spec.memoryCapacity ? preset.memoryUnit : "GB",
    nodeKnown: spec.nodeNm === preset.spec.nodeNm ? preset.nodeKnown : spec.nodeNm > 0,
    deviceSeu:
      preset.deviceSeu && spec.seuCrossSection === undefined && spec.name === preset.spec.name
        ? preset.deviceSeu
        : undefined,
    ratioLabel,
  });

  return (
    <div data-testid="chip-spec-studio">
      {phase === "loading" ? <p className="body rok-muted">Loading</p> : null}
      {phase === "error" ? (
        <p className="body" style={{ color: "var(--status-critical)" }}>
          Error
        </p>
      ) : null}
      {phase === "empty" ? <p className="body rok-muted">Empty</p> : null}
      <label className="rok-field">
        <span className="rok-field__label eyebrow">Preset</span>
        <select
          className="rok-field__input body"
          data-testid="preset-select"
          value={presetId}
          onChange={(event) => applyPreset(event.target.value)}
        >
          {PRESETS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
      <form
        onSubmit={(event) => event.preventDefault()}
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginTop: "var(--space-4)" }}
      >
        <label className="rok-field">
          <span className="rok-field__label eyebrow">
            Vendor <SourceBadge label={badgeForField(preset, "vendor", spec.vendor)} />
          </span>
          <input className="rok-field__input body" {...form.register("vendor")} />
        </label>
        <label className="rok-field">
          <span className="rok-field__label eyebrow">
            Name <SourceBadge label={badgeForField(preset, "name", spec.name)} />
          </span>
          <input className="rok-field__input body" {...form.register("name")} />
        </label>
        <label className="rok-field">
          <span className="rok-field__label eyebrow">
            Memory type <SourceBadge label={badgeForField(preset, "memoryType", spec.memoryType)} />
          </span>
          <input className="rok-field__input body" {...form.register("memoryType")} />
        </label>
        <label className="rok-field">
          <span className="rok-field__label eyebrow">
            ECC scheme <SourceBadge label={badgeForField(preset, "eccScheme", spec.eccScheme)} />
          </span>
          <input className="rok-field__input body" {...form.register("eccScheme")} />
        </label>
        {NUMBER_FIELDS.map((field) => (
          <label className="rok-field" key={field.key}>
            <span className="rok-field__label eyebrow">
              {field.label} <SourceBadge label={badgeForField(preset, field.key, spec[field.key])} />
            </span>
            <input
              className="rok-field__input body"
              type="number"
              step="any"
              {...form.register(field.key, { valueAsNumber: true })}
            />
          </label>
        ))}
        <label className="rok-field">
          <span className="rok-field__label eyebrow">
            Average power (kW) <SourceBadge label={badgeForField(preset, "avgPowerKw", spec.avgPowerKw)} />
          </span>
          <input className="rok-field__input body" type="number" step="any" {...form.register("avgPowerKw", { valueAsNumber: true })} />
          {ai1 ? (
            <input
              data-testid="avg-slider"
              type="range"
              min={120}
              max={175}
              step={1}
              value={Number.isFinite(spec.avgPowerKw) ? spec.avgPowerKw : 120}
              onChange={(event) => form.setValue("avgPowerKw", Number(event.target.value), { shouldDirty: true })}
            />
          ) : null}
          <Num value={spec.avgPowerKw} digits={0} label={badgeForField(preset, "avgPowerKw", spec.avgPowerKw)} unit="kW" />
          {ai1 ? <span className="body-sm rok-muted"> Slider range is 120 to 175.</span> : null}
        </label>
        <label className="rok-field">
          <span className="rok-field__label eyebrow">
            Peak power (kW) <SourceBadge label={badgeForField(preset, "peakPowerKw", spec.peakPowerKw)} />
          </span>
          <input className="rok-field__input body" type="number" step="any" {...form.register("peakPowerKw", { valueAsNumber: true })} />
          {ai1 ? (
            <input
              data-testid="peak-slider"
              type="range"
              min={150}
              max={250}
              step={1}
              value={Number.isFinite(spec.peakPowerKw) ? spec.peakPowerKw : 150}
              onChange={(event) => form.setValue("peakPowerKw", Number(event.target.value), { shouldDirty: true })}
            />
          ) : null}
          <Num value={spec.peakPowerKw} digits={0} label={badgeForField(preset, "peakPowerKw", spec.peakPowerKw)} unit="kW" />
          {ai1 && preset.peakKind === "solar" ? (
            <span className="body-sm rok-muted"> Peak on this sheet is peak solar. Slider range is 150 to 250.</span>
          ) : null}
          {ai1 && preset.peakKind === "compute" ? (
            <span className="body-sm rok-muted"> Peak on this sheet is peak compute. Slider range is 150 to 250.</span>
          ) : null}
        </label>
        <label className="rok-field">
          <span className="rok-field__label eyebrow">
            Radiator area (m²) <SourceBadge label={badgeForPayload(preset, "radiatorAreaM2", payload.radiatorAreaM2)} />
          </span>
          <input
            className="rok-field__input body"
            type="number"
            step="any"
            value={payload.radiatorAreaM2}
            onChange={(event) => setPayload({ ...payload, radiatorAreaM2: Number(event.target.value) })}
          />
        </label>
        <div>
          <span className="eyebrow">
            Radiator sides <SourceBadge label={badgeForPayload(preset, "radiatorSides", payload.radiatorSides)} />
          </span>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <button
              type="button"
              className="rok-btn"
              data-testid="sides-1"
              aria-pressed={payload.radiatorSides === 1}
              onClick={() => setPayload({ ...payload, radiatorSides: 1 })}
            >
              1 side
            </button>
            <button
              type="button"
              className="rok-btn"
              data-testid="sides-2"
              aria-pressed={payload.radiatorSides === 2}
              onClick={() => setPayload({ ...payload, radiatorSides: 2 })}
            >
              2 sides
            </button>
          </div>
        </div>
        <label className="rok-field">
          <span className="rok-field__label eyebrow">
            Sink temperature (K) <SourceBadge label={badgeForPayload(preset, "tSinkK", payload.tSinkK)} />
          </span>
          <input
            className="rok-field__input body"
            data-testid="tsink"
            type="number"
            step="any"
            value={payload.tSinkK}
            onChange={(event) => setPayload({ ...payload, tSinkK: Number(event.target.value) })}
          />
        </label>
        <label className="rok-field">
          <span className="rok-field__label eyebrow">
            Emissivity <SourceBadge label={badgeForPayload(preset, "emissivity", payload.emissivity)} />
          </span>
          <input
            className="rok-field__input body"
            type="number"
            step="any"
            value={payload.emissivity}
            onChange={(event) => setPayload({ ...payload, emissivity: Number(event.target.value) })}
          />
        </label>
      </form>
      {phase === "ready" ? (
        <div className="body" style={{ marginTop: "var(--space-4)" }}>
          <p>
            Average at 320 K <Num value={impact.thermal.areaAvg320.value} digits={1} label="estimate" unit="m²" />
            . Average at 340 K <Num value={impact.thermal.areaAvg340.value} digits={1} label="estimate" unit="m²" />.
          </p>
          <p>
            Peak at 320 K <Num value={impact.thermal.areaPeak320.value} digits={1} label="estimate" unit="m²" />
            . Peak at 340 K <Num value={impact.thermal.areaPeak340.value} digits={1} label="estimate" unit="m²" />.
          </p>
          <p>
            Sheet pair{" "}
            <Num value={impact.thermal.kwPerM2.value} digits={2} label={impact.thermal.kwPerM2.label} unit="kW/m²" />.
            Radiator{" "}
            <Num value={impact.thermal.radiatorTemperatureK.value} digits={1} label={impact.thermal.radiatorTemperatureK.label} unit="K" />
            {preset.inletC ? (
              <>
                {" "}
                beside inlet <Num value={preset.inletC.value} digits={0} label={preset.inletC.label} unit="°C" />. {preset.inletC.note}
              </>
            ) : null}
          </p>
          {impact.thermal.peakFlag ? (
            <p data-testid="peak-flag" data-peak-flag="true">
              {PEAK_FLAG_TEXT}
            </p>
          ) : (
            <p data-testid="peak-flag" data-peak-flag="false">
              Peak power stays inside the installed radiator across 320 K to 340 K.
            </p>
          )}
          <p className="rok-muted">{impact.thermal.assumptions[0]}</p>
          <ul>
            {preset.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <h3 className="heading-md">Action costs</h3>
      <p className="body">
        Downtime cost per hour <Num value={POLICY_COSTS.downtime_cost_per_hour} digits={0} label="estimate" unit="1/h" />. {POLICY_COSTS.note}
      </p>
      <table className="body">
        <thead>
          <tr>
            <th>Action</th>
            <th>Downtime hours</th>
            <th>Uncorrectable weight</th>
            <th>Switch cost</th>
            <th>Power scale</th>
          </tr>
        </thead>
        <tbody>
          {ACTION_ORDER.map((name) => {
            const row = POLICY_COSTS.actions[name];
            return (
              <tr key={name}>
                <td>{name}</td>
                <td>
                  <Num value={row.downtime_hours} digits={2} label="estimate" unit="h" />
                </td>
                <td>
                  <Num value={row.uncorrectable_weight} digits={2} label="estimate" unit="1" />
                </td>
                <td>
                  <Num value={row.switch_cost} digits={2} label="estimate" unit="1" />
                </td>
                <td>
                  <Num value={row.power_scale} digits={2} label="estimate" unit="1" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
