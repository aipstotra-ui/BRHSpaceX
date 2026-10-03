"use client";

import { useEffect, useState } from "react";

import { SourceBadge } from "@/components/ui/SourceBadge";
import {
  AI1_ALTITUDE_ASSUMPTION,
  FCC_ALT_MAX_KM,
  FCC_ALT_MIN_KM,
  FCC_FILING_URL,
  SOLAR_ARRAY_M2,
  SOLAR_ARRAY_URL,
} from "@/lib/engine/orbit/constants";
import { DERIVED_SHELL } from "@/lib/engine/orbit/derivedShell";
import { fccAltitudeSchema, inclinationSchema, ltanSchema } from "@/lib/engine/orbit/schema";
import { ssoInclinationDeg } from "@/lib/engine/orbit/sso";
import { useOrbitStore, type OrbitPreset } from "@/lib/store/orbit";
import type { SourceLabel } from "@/lib/types";

type Phase = "loading" | "error" | "empty" | "ready";

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
    <span data-orbit-number>
      {value.toFixed(digits)} {unit} <SourceBadge label={label} />
    </span>
  );
}

const PRESETS: { id: OrbitPreset; title: string }[] = [
  { id: "initial", title: "Initial demo orbit" },
  { id: "sso-dawn", title: "SSO dawn-dusk 06:00" },
  { id: "sso-noon", title: "SSO noon-midnight 12:00" },
  { id: "starlink-shell", title: "Starlink shell" },
];

export function OrbitLocation() {
  const altitudeKm = useOrbitStore((state) => state.altitudeKm);
  const inclinationDeg = useOrbitStore((state) => state.inclinationDeg);
  const sunSynchronous = useOrbitStore((state) => state.sunSynchronous);
  const ltanHours = useOrbitStore((state) => state.ltanHours);
  const raanDeg = useOrbitStore((state) => state.raanDeg);
  const preset = useOrbitStore((state) => state.preset);
  const vehicle = useOrbitStore((state) => state.vehicle);
  const setAltitudeKm = useOrbitStore((state) => state.setAltitudeKm);
  const setInclinationDeg = useOrbitStore((state) => state.setInclinationDeg);
  const setLtanHours = useOrbitStore((state) => state.setLtanHours);
  const setSunSynchronous = useOrbitStore((state) => state.setSunSynchronous);
  const setVehicle = useOrbitStore((state) => state.setVehicle);
  const applyPreset = useOrbitStore((state) => state.applyPreset);
  const [booted, setBooted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setBooted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  const derived =
    !sunSynchronous && Math.abs(altitudeKm - DERIVED_SHELL.meanAltitudeKm) < 1e-6;
  const sliderMin = altitudeKm < FCC_ALT_MIN_KM ? altitudeKm : FCC_ALT_MIN_KM;
  const phase: Phase = !booted ? "loading" : error ? "error" : !(altitudeKm > 0) ? "empty" : "ready";

  function commitAltitude(raw: number) {
    if (!Number.isFinite(raw)) {
      setError("Altitude is not a number.");
      return;
    }
    const snapped =
      raw < FCC_ALT_MIN_KM && Math.abs(raw - DERIVED_SHELL.meanAltitudeKm) > 0.51 ? FCC_ALT_MIN_KM : raw;
    if (snapped >= FCC_ALT_MIN_KM && !fccAltitudeSchema.safeParse(snapped).success) {
      setError("Altitude is outside the FCC filing slider.");
      return;
    }
    setError(null);
    setAltitudeKm(snapped);
  }

  return (
    <div className="body">
      {phase === "loading" ? <p className="rok-muted">Loading</p> : null}
      {phase === "error" ? <p style={{ color: "var(--status-critical)" }}>{error ?? "Error"}</p> : null}
      {phase === "empty" ? <p className="rok-muted">Empty</p> : null}
      {phase === "ready" ? (
        <>
          <p className="rok-muted">
            FCC constellation filing range, not AI1:{" "}
            <span data-orbit-number>
              {FCC_ALT_MIN_KM} km <SourceBadge label="source" />
            </span>{" "}
            to{" "}
            <span data-orbit-number>
              {FCC_ALT_MAX_KM} km <SourceBadge label="source" />
            </span>{" "}
            ({FCC_FILING_URL}).
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", margin: "var(--space-3) 0" }}>
            {PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="rok-btn"
                aria-pressed={preset === item.id}
                onClick={() => {
                  setError(null);
                  applyPreset(item.id);
                }}
              >
                {item.title}
              </button>
            ))}
          </div>
          {derived ? <p>{AI1_ALTITUDE_ASSUMPTION}</p> : null}
          <label className="rok-field">
            Altitude (km)
            <input
              aria-label="Altitude"
              type="range"
              min={sliderMin}
              max={FCC_ALT_MAX_KM}
              step="any"
              value={altitudeKm}
              onChange={(event) => commitAltitude(Number(event.target.value))}
            />
          </label>
          <p>
            Altitude <Num value={altitudeKm} digits={3} label="estimate" unit="km" />
          </p>
          <label className="rok-field">
            <input
              type="checkbox"
              checked={sunSynchronous}
              onChange={(event) => setSunSynchronous(event.target.checked)}
            />{" "}
            Sun-synchronous
          </label>
          <label className="rok-field">
            Inclination (deg)
            <input
              aria-label="Inclination"
              type="range"
              min={0}
              max={180}
              step="any"
              value={inclinationDeg}
              disabled={sunSynchronous}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!inclinationSchema.safeParse(next).success) {
                  setError("Inclination is outside 0 to 180 degrees.");
                  return;
                }
                setError(null);
                setInclinationDeg(next);
              }}
            />
          </label>
          <p>
            Inclination{" "}
            <Num
              value={sunSynchronous ? ssoInclinationDeg(altitudeKm) : inclinationDeg}
              digits={4}
              label={sunSynchronous ? "source" : "estimate"}
              unit="deg"
            />
            {sunSynchronous ? " J2 condition, slider locked." : null}
          </p>
          {sunSynchronous ? (
            <>
              <label className="rok-field">
                LTAN (h)
                <input
                  aria-label="LTAN"
                  type="range"
                  min={0}
                  max={23.75}
                  step={0.25}
                  value={ltanHours ?? 6}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (!ltanSchema.safeParse(next).success) {
                      setError("LTAN is outside 0 to 24 hours.");
                      return;
                    }
                    setError(null);
                    setLtanHours(next);
                  }}
                />
              </label>
              <p>
                LTAN <Num value={ltanHours ?? 6} digits={2} label="estimate" unit="h" />. Dawn-dusk is 06:00/18:00.
                Noon-midnight is 12:00/00:00.
              </p>
            </>
          ) : (
            <p>
              RAAN <Num value={raanDeg} digits={1} label="estimate" unit="deg" />. Non-SSO RAAN 0 is an estimate. No
              LTAN is taken from the Starlink snapshot.
            </p>
          )}
          <p>
            Largest shell count <Num value={DERIVED_SHELL.count} digits={0} label="estimate" unit="objects" />. Solar
            array{" "}
            <span data-orbit-number>
              {SOLAR_ARRAY_M2} m² <SourceBadge label="source" />
            </span>{" "}
            from 210 kW ÷ 250 W/m² ({SOLAR_ARRAY_URL}). The page does not print 840 m². This is not a drag area.
          </p>
          <p className="rok-muted">Vehicle inputs are estimates. They are not Starlink values.</p>
          {(
            [
              ["massKg", "Mass (kg)"],
              ["dragAreaM2", "Drag area (m²)"],
              ["cd", "Cd"],
              ["eolAltitudeKm", "End-of-life altitude (km)"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="rok-field">
              {label}
              <input
                aria-label={label}
                type="number"
                value={vehicle[key]}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (!(next > 0)) {
                    setError(`${label} must be positive.`);
                    return;
                  }
                  setError(null);
                  setVehicle({ ...vehicle, [key]: next });
                }}
              />
              <Num value={vehicle[key]} digits={2} label="estimate" unit="" />
            </label>
          ))}
        </>
      ) : null}
    </div>
  );
}
