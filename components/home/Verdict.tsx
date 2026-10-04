"use client";

import { useImpactStore } from "@/components/home/impactStore";
import { formatNumber, Num } from "@/components/panels/OrbitImpact";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EXPOSURE_COLORS, type ExposureClass } from "@/lib/engine/globe/exposure";
import type { RangeValue } from "@/lib/engine/orbit/range";

function bindingText(binding: string): string {
  if (binding === "TID") {
    return "Limited by radiation dose (TID)";
  }
  if (binding === "drag") {
    return "Limited by orbital decay (drag)";
  }
  return "Radiation and drag limits are equal";
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

export function Verdict() {
  const phase = useImpactStore((state) => state.phase);
  const result = useImpactStore((state) => state.result);

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
          </div>

          <div className="stat-grid">
            <div className="rok-stat">
              <p className="rok-stat__label eyebrow">Annual dose</p>
              <Num value={result.annualDose.mid} digits={3} label={result.annualDose.label} unit="krad(Si)/yr" />
            </div>
            <div className="rok-stat">
              <p className="rok-stat__label eyebrow">Upset rate</p>
              <Num value={result.upsetRate.mid} digits={1} label={result.upsetRate.label} unit="1/s" />
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
            <h3 className="eyebrow rok-subtle">Where the danger is</h3>
            <Exposure kind="SAA" title="South Atlantic Anomaly" value={result.saaFraction} />
            <Exposure kind="auroral" title="Auroral zone" value={result.auroralFraction} />
            <Exposure kind="outer belt" title="Outer belt" value={result.outerBeltFraction} />
          </div>

          {result.storms.length > 0 ? (
            <div className="stack stack--tight">
              <h3 className="eyebrow rok-subtle">If a severe storm hits ({result.storms[result.storms.length - 1].level})</h3>
              <p className="body-sm">
                Upsets rise by{" "}
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
