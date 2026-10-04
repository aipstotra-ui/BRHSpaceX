"use client";

import { useMemo } from "react";

import { useImpactStore } from "@/components/home/impactStore";
import { formatNumber, Num } from "@/components/panels/OrbitImpact";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EXPOSURE_COLORS, type ExposureClass } from "@/lib/engine/globe/exposure";
import type { RangeValue } from "@/lib/engine/orbit/range";
import { auroralBoundaryMlatDeg, sepActive, zoneFractions } from "@/lib/engine/orbit/stormZones";
import { estimatedStormMultiplier } from "@/lib/engine/upsets";
import { doseGridDepthRange } from "@/lib/engine/orbit/doseGrid";
import { useShellStore } from "@/lib/store";
import { useOrbitStore } from "@/lib/store/orbit";
import { useTimelineCursor } from "@/lib/store/timeline";

function bindingText(binding: string): string {
  if (binding === "TID") {
    return "Limited by radiation dose (TID)";
  }
  if (binding === "drag") {
    return "Limited by orbital decay (drag)";
  }
  return "Radiation and drag limits are equal";
}

function Share({ kind, title, share, note }: { kind: ExposureClass; title: string; share: number; note: string }) {
  const percent = Math.max(0, Math.min(100, share * 100));
  return (
    <div className="exposure">
      <div className="exposure__head">
        <span className="exposure__name">
          <span className="swatch" style={{ background: EXPOSURE_COLORS[kind] }} aria-hidden="true" />
          {title}
        </span>
        <span data-orbit-number className="num">
          {formatNumber(percent, 1)}
          <span className="num__unit"> % of orbit</span> <SourceBadge label="estimate" />
        </span>
      </div>
      <div
        className="rok-progress__track"
        role="progressbar"
        aria-label={`${title} share of orbit`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
      >
        <div className="rok-progress__fill" style={{ width: `${percent}%`, background: EXPOSURE_COLORS[kind] }} />
      </div>
      <p className="note">{note}</p>
    </div>
  );
}

function Exposure({ kind, title, value }: { kind: ExposureClass; title: string; value: RangeValue }) {
  const percent = Math.max(0, Math.min(100, value.mid * 100));
  return (
    <div className="exposure">
      <div className="exposure__head">
        <span className="exposure__name">
          <span className="swatch" style={{ background: EXPOSURE_COLORS[kind] }} aria-hidden="true" />
          {title}
        </span>
        <span data-orbit-number className="num">
          {formatNumber(percent, 1)}
          <span className="num__unit"> % of orbit</span> <SourceBadge label={value.label} />
        </span>
      </div>
      <div
        className="rok-progress__track"
        role="progressbar"
        aria-label={`${title} share of orbit`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
      >
        <div className="rok-progress__fill" style={{ width: `${percent}%`, background: EXPOSURE_COLORS[kind] }} />
      </div>
      <p className="note">
        Varies {formatNumber(value.low * 100, 1)}–{formatNumber(value.high * 100, 1)} % with Earth rotation phase
      </p>
    </div>
  );
}

function timeLabel(timeMs: number | undefined, kind: string | undefined): string {
  if (timeMs === undefined) {
    return "quiet conditions";
  }
  const when = new Date(timeMs).toISOString().slice(5, 16).replace("T", " ");
  return kind === "forecast" ? `${when} UTC (forecast)` : `${when} UTC`;
}

export function Verdict() {
  const phase = useImpactStore((state) => state.phase);
  const result = useImpactStore((state) => state.result);
  const altitudeKm = useOrbitStore((state) => state.altitudeKm);
  const inclinationDeg = useOrbitStore((state) => state.inclinationDeg);
  const sunSynchronous = useOrbitStore((state) => state.sunSynchronous);
  const ltanHours = useOrbitStore((state) => state.ltanHours);
  const raanDeg = useOrbitStore((state) => state.raanDeg);
  const shieldingMmAl = useShellStore((state) => state.spec.shieldingMmAl);
  const depthRange = doseGridDepthRange();
  const readDepth = depthRange ? Math.min(depthRange.max, Math.max(depthRange.min, shieldingMmAl)) : null;
  const cursor = useTimelineCursor();
  // Kp 2 is the engine's quiet reference (impact.ts SNAPSHOT_KP) when the timeline has no value yet.
  const kp = cursor.point?.kp ?? 2;
  const pfu = cursor.point?.protonPfu ?? null;
  const protonsOn = pfu !== null && sepActive(pfu);
  const zones = useMemo(
    () => zoneFractions({ altitudeKm, inclinationDeg, sunSynchronous, ltanHours, raanDeg }, kp),
    [altitudeKm, inclinationDeg, sunSynchronous, ltanHours, raanDeg, kp],
  );
  const upsetNow = result
    ? result.upsetRate.mid * estimatedStormMultiplier(kp).value +
      (protonsOn && pfu !== null ? result.upsetPerUnitFlux * pfu * 4 * Math.PI * zones.sepCap : 0)
    : 0;

  return (
    <section className="rok-panel verdict" aria-labelledby="verdict-title" aria-live="polite">
      <p className="eyebrow rok-panel__eyebrow">At the chosen orbit</p>
      <h2 id="verdict-title" className="heading-md rok-panel__title">
        Chip outlook
      </h2>
      {phase === "error" ? (
        <p className="body" style={{ color: "var(--status-critical)" }}>
          Error
        </p>
      ) : phase === "empty" ? (
        <p className="body rok-muted">Empty</p>
      ) : !result ? (
        <p className="body rok-muted">Loading</p>
      ) : (
        <div className="stack" data-loading={phase === "loading" || undefined}>
          <div className="rok-stat">
            <p className="rok-stat__label eyebrow">Estimated lifetime</p>
            <div className="rok-stat__row">
              <span data-orbit-number className="rok-stat__value data-xl">
                {formatNumber(result.lifetimeYears.mid, 1)}
                <span className="rok-stat__unit data-md"> YR</span>{" "}
                <SourceBadge label={result.lifetimeYears.label} />
              </span>
            </div>
            <p className="body-sm rok-muted">{bindingText(result.binding)}</p>
            {readDepth !== null ? (
              <p className="note">
                Dose read behind {readDepth} mm Al
                {readDepth !== shieldingMmAl ? ` (chip shielding ${shieldingMmAl} mm is below the grid, so this is a thin-shield upper bound)` : ""}.
                Set shielding on the case page.
              </p>
            ) : null}
          </div>

          <div className="stat-grid">
            <div className="rok-stat">
              <p className="rok-stat__label eyebrow">Annual dose</p>
              <Num value={result.annualDose.mid} digits={3} label={result.annualDose.label} unit="krad(Si)/yr" />
            </div>
            <div className="rok-stat">
              <p className="rok-stat__label eyebrow">Upset rate at Kp {kp.toFixed(1)}</p>
              <Num value={upsetNow} digits={1} label="estimate" unit="1/s" />
              {protonsOn ? <StatusBadge status="critical">Proton event</StatusBadge> : null}
            </div>
            <div className="rok-stat">
              <p className="rok-stat__label eyebrow">Thermal margin</p>
              <Num value={result.thermalMarginC.mid} digits={1} label={result.thermalMarginC.label} unit="°C" />
              {result.thermalMarginC.mid < 0 ? (
                <StatusBadge status="critical">Over limit</StatusBadge>
              ) : (
                <StatusBadge status="nominal">Within limit</StatusBadge>
              )}
            </div>
            <div className="rok-stat">
              <p className="rok-stat__label eyebrow">Time in shadow</p>
              <Num
                value={result.eclipseFraction.mid * 100}
                digits={1}
                label={result.eclipseFraction.label}
                unit="%"
              />
            </div>
          </div>

          <div className="stack stack--tight">
            <h3 className="eyebrow rok-subtle">
              Where the danger is · {timeLabel(cursor.point?.timeMs, cursor.point?.kind)}
            </h3>
            <Exposure kind="SAA" title="South Atlantic Anomaly" value={result.saaFraction} />
            <Share
              kind="SEP"
              title="Solar-proton polar cap"
              share={protonsOn ? zones.sepCap : 0}
              note={
                protonsOn
                  ? `Proton event (${formatNumber(pfu ?? 0, 0)} pfu). Protons reach this orbit poleward of the cutoff.`
                  : `No proton event. During one at this Kp, ${formatNumber(zones.sepCap * 100, 1)} % of the orbit would be exposed.`
              }
            />
            <Share
              kind="auroral"
              title="Auroral oval"
              share={zones.auroral}
              note={`Oval edge at ${formatNumber(auroralBoundaryMlatDeg(kp), 1)}° magnetic latitude for Kp ${kp.toFixed(1)}.`}
            />
            <Exposure kind="outer belt" title="Outer belt" value={result.outerBeltFraction} />
          </div>

          {result.storms.length > 0 ? (
            <div className="stack stack--tight">
              <h3 className="eyebrow rok-subtle">If a severe storm hits ({result.storms[result.storms.length - 1].level})</h3>
              <p className="body-sm">
                The aurora spreads to{" "}
                <Num
                  value={result.storms[result.storms.length - 1].auroralShare * 100}
                  digits={1}
                  label="estimate"
                  unit="% of the orbit"
                />{" "}
                (quiet: <Num value={result.quietAuroralShare * 100} digits={1} label="estimate" unit="%" />). Trapped
                upsets rise by{" "}
                <Num
                  value={result.storms[result.storms.length - 1].deltaUpsetPerS.mid}
                  digits={1}
                  label="estimate"
                  unit="1/s"
                />{" "}
                and drag life drops by{" "}
                <Num
                  value={result.storms[result.storms.length - 1].deltaDragYears.mid}
                  digits={2}
                  label="estimate"
                  unit="yr"
                />
                .
              </p>
            </div>
          ) : null}
          <p className="note">Orbit-averaged. Multi-year values use climatology, not the short-term forecaster.</p>
        </div>
      )}
    </section>
  );
}
