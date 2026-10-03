"use client";

import { useEffect, useState } from "react";

import { SourceBadge } from "@/components/ui/SourceBadge";
import { orbitImpact, type OrbitImpactResult } from "@/lib/engine/orbitImpact";
import { getPreset } from "@/lib/presets";
import { useShellStore } from "@/lib/store";
import { useOrbitStore } from "@/lib/store/orbit";
import type { SourceLabel } from "@/lib/types";

type Phase = "loading" | "error" | "empty" | "ready";

function Num({
  value,
  digits,
  label,
  unit,
  testId,
}: {
  value: number;
  digits: number;
  label: SourceLabel;
  unit: string;
  testId?: string;
}) {
  const text = Math.abs(value) >= 1e6 || (value !== 0 && Math.abs(value) < 1e-3) ? value.toExponential(3) : value.toFixed(digits);
  return (
    <span data-orbit-number data-testid={testId}>
      {text} {unit} <SourceBadge label={label} />
    </span>
  );
}

function Band({
  title,
  value,
  digits,
  testId,
}: {
  title: string;
  value: OrbitImpactResult["eclipseFraction"];
  digits: number;
  testId?: string;
}) {
  return (
    <p>
      {title} low <Num value={value.low} digits={digits} label={value.label} unit={value.unit} /> mid{" "}
      <Num value={value.mid} digits={digits} label={value.label} unit={value.unit} testId={testId} /> high{" "}
      <Num value={value.high} digits={digits} label={value.label} unit={value.unit} />
    </p>
  );
}

export function OrbitImpact() {
  const altitudeKm = useOrbitStore((state) => state.altitudeKm);
  const inclinationDeg = useOrbitStore((state) => state.inclinationDeg);
  const sunSynchronous = useOrbitStore((state) => state.sunSynchronous);
  const ltanHours = useOrbitStore((state) => state.ltanHours);
  const raanDeg = useOrbitStore((state) => state.raanDeg);
  const vehicle = useOrbitStore((state) => state.vehicle);
  const presetId = useShellStore((state) => state.presetId);
  const spec = useShellStore((state) => state.spec);
  const payload = useShellStore((state) => state.payload);
  const [phase, setPhase] = useState<Phase>("loading");
  const [result, setResult] = useState<OrbitImpactResult | null>(null);
  const [workerMs, setWorkerMs] = useState<number | null>(null);

  const vehicleKey = JSON.stringify(vehicle);
  const specKey = JSON.stringify(spec);
  const payloadKey = JSON.stringify(payload);

  useEffect(() => {
    if (!(altitudeKm > 0)) {
      return;
    }
    let cancelled = false;
    let worker: Worker | null = null;
    const job = window.setTimeout(() => {
      setPhase("loading");
      const chip = getPreset(presetId);
      const input = {
        altitudeKm,
        inclinationDeg,
        sunSynchronous,
        ltanHours,
        raanDeg,
        vehicle: JSON.parse(vehicleKey) as typeof vehicle,
        spec: JSON.parse(specKey) as typeof spec,
        payload: JSON.parse(payloadKey) as typeof payload,
        memoryUnit: chip.memoryUnit,
        nodeKnown: chip.nodeKnown,
        deviceSeu: chip.deviceSeu,
      };
      const apply = (next: OrbitImpactResult, ms: number) => {
        if (cancelled) {
          return;
        }
        setResult(next);
        setWorkerMs(ms);
        setPhase("ready");
      };
      const fail = () => {
        if (!cancelled) {
          setPhase("error");
        }
      };
      try {
        worker = new Worker(new URL("../../lib/engine/orbit.worker.ts", import.meta.url));
        worker.onmessage = (event: MessageEvent<{ id: number; ok: boolean; result?: OrbitImpactResult; ms?: number }>) => {
          if (event.data.id !== 1 || cancelled) {
            return;
          }
          if (!event.data.ok || !event.data.result || event.data.ms === undefined) {
            fail();
            return;
          }
          apply(event.data.result, event.data.ms);
        };
        worker.onerror = () => fail();
        worker.postMessage({ id: 1, input });
      } catch {
        try {
          const next = orbitImpact(input);
          apply(next, next.environmentMs);
        } catch {
          fail();
        }
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(job);
      worker?.terminate();
    };
  }, [altitudeKm, inclinationDeg, sunSynchronous, ltanHours, raanDeg, vehicleKey, specKey, payloadKey, presetId, vehicle, spec, payload]);

  if (!(altitudeKm > 0)) {
    return <p className="body rok-muted">Empty</p>;
  }
  if (phase === "loading" || !result) {
    return <p className="body rok-muted">Loading</p>;
  }
  if (phase === "error") {
    return (
      <p className="body" style={{ color: "var(--status-critical)" }}>
        Error
      </p>
    );
  }

  return (
    <div className="body">
      <p>orbit-averaged; multi-year values use climatology (M7), not the short-term forecaster</p>
      <p data-testid="binding">
        Binding limit: {result.binding}. Lifetime{" "}
        <Num value={result.lifetimeYears.mid} digits={2} label={result.lifetimeYears.label} unit="yr" testId="lifetime-mid" />
      </p>
      <Band title="Upset rate" value={result.upsetRate} digits={3} testId="upset-mid" />
      <Band title="Annual dose" value={result.annualDose} digits={4} testId="dose-mid" />
      <Band title="Time to TID" value={result.tidYears} digits={2} />
      <Band title="Drag decay" value={result.dragYears} digits={2} testId="drag-mid" />
      <Band title="SAA fraction" value={result.saaFraction} digits={4} />
      <Band title="Auroral fraction" value={result.auroralFraction} digits={4} />
      <Band title="Outer-belt fraction" value={result.outerBeltFraction} digits={4} />
      <Band title="Eclipse fraction" value={result.eclipseFraction} digits={4} testId="eclipse-mid" />
      <p>
        Thermal margin <Num value={result.thermalMarginC.mid} digits={2} label={result.thermalMarginC.label} unit="°C" />.
        Eclipse fraction is shown beside it and does not change the M4 temperature.
      </p>
      <p>
        Shielding <Num value={result.shieldingMmAl.mid} digits={2} label={result.shieldingMmAl.label} unit="mm Al" /> is
        not applied.
      </p>
      <p>
        Worker time{" "}
        {workerMs === null ? null : <Num value={workerMs} digits={1} label="estimate" unit="ms" testId="worker-ms" />}
      </p>
      {result.storms.map((storm) => (
        <p key={storm.level}>
          {storm.level} Kp <Num value={storm.kp} digits={0} label="source" unit="" /> Δupset{" "}
          <Num value={storm.deltaUpsetPerS.mid} digits={3} label="estimate" unit="1/s" /> Δdrag{" "}
          <Num value={storm.deltaDragYears.mid} digits={2} label="estimate" unit="yr" />
        </p>
      ))}
    </div>
  );
}
