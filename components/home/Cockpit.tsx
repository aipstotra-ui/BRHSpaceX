"use client";

import { useMemo, useState } from "react";

import { Globe } from "@/components/globe/Globe";
import { RE_M } from "@/lib/engine/orbit/constants";
import { DERIVED_SHELL } from "@/lib/engine/orbit/derivedShell";
import { orbitImpact, type OrbitImpactResult } from "@/lib/engine/orbitImpact";
import { replayOnOrbit } from "@/lib/engine/replayOnOrbit";
import { fccAltitudeSchema } from "@/lib/engine/orbit/schema";
import { ssoInclinationDeg } from "@/lib/engine/orbit/sso";
import { PRESETS } from "@/lib/presets";
import { useShellStore } from "@/lib/store";
import { useOrbitStore } from "@/lib/store/orbit";

const HEIGHTS = [500, 800, 1100, 1400, 1700, 2000];

type Period = "quiet" | "typical" | "active" | "may2024";

const PERIODS: { id: Period; label: string }[] = [
  { id: "quiet", label: "Quiet sun" },
  { id: "typical", label: "Typical" },
  { id: "active", label: "Active sun" },
  { id: "may2024", label: "May 2024" },
];

function pick(impact: OrbitImpactResult, period: Exclude<Period, "may2024">) {
  const tid = period === "quiet" ? impact.tidYears.high : period === "active" ? impact.tidYears.low : impact.tidYears.mid;
  const drag = period === "quiet" ? impact.dragYears.high : period === "active" ? impact.dragYears.low : impact.dragYears.mid;
  if (tid < drag) {
    return { years: tid, binding: "radiation" };
  }
  if (drag < tid) {
    return { years: drag, binding: "falling down" };
  }
  return { years: tid, binding: "both" };
}

export function Cockpit() {
  const presetId = useShellStore((state) => state.presetId);
  const spec = useShellStore((state) => state.spec);
  const payload = useShellStore((state) => state.payload);
  const setStudio = useShellStore((state) => state.setStudio);
  const altitudeKm = useOrbitStore((state) => state.altitudeKm);
  const inclinationDeg = useOrbitStore((state) => state.inclinationDeg);
  const vehicle = useOrbitStore((state) => state.vehicle);
  const setAltitudeKm = useOrbitStore((state) => state.setAltitudeKm);
  const setSunSynchronous = useOrbitStore((state) => state.setSunSynchronous);
  const setLtanHours = useOrbitStore((state) => state.setLtanHours);
  const [period, setPeriod] = useState<Period>("typical");

  const rows = useMemo(
    () =>
      HEIGHTS.map((altitude) => {
        const impact = orbitImpact({
          altitudeKm: altitude,
          inclinationDeg: ssoInclinationDeg(altitude),
          sunSynchronous: true,
          ltanHours: 6,
          raanDeg: 0,
          vehicle,
          spec,
          payload,
        });
        return { altitude, impact, stormCost: replayOnOrbit(altitude).chosen.cost };
      }),
    [payload, spec, vehicle],
  );

  const here = useMemo(
    () =>
      orbitImpact({
        altitudeKm,
        inclinationDeg,
        sunSynchronous: true,
        ltanHours: 6,
        raanDeg: 0,
        vehicle,
        spec,
        payload,
      }),
    [altitudeKm, inclinationDeg, payload, spec, vehicle],
  );

  const best = useMemo(() => {
    if (period === "may2024") {
      return rows.reduce((winner, row) => (row.stormCost < winner.stormCost ? row : winner));
    }
    return rows.reduce((winner, row) => {
      const years = pick(row.impact, period).years;
      const bestYears = pick(winner.impact, period).years;
      return years > bestYears ? row : winner;
    });
  }, [period, rows]);

  const shown = period === "may2024" ? null : pick(here, period);
  const sliderMin = altitudeKm < 500 ? Math.floor(altitudeKm) : 500;

  function useSuggested() {
    setSunSynchronous(true);
    setAltitudeKm(best.altitude);
    setLtanHours(6);
  }

  function onAltitude(raw: number) {
    const next = raw < 500 && Math.abs(raw - DERIVED_SHELL.meanAltitudeKm) > 0.51 ? 500 : raw;
    if (next >= 500 && !fccAltitudeSchema.safeParse(next).success) {
      return;
    }
    setAltitudeKm(next);
  }

  return (
    <main className="cockpit">
      <section aria-label="Earth">
        <Globe />
      </section>
      <section className="body" aria-label="Result">
        <h1 className="heading-md">Where the chip lasts</h1>
        <label className="rok-field">
          Chip
          <select
            aria-label="Chip"
            value={presetId}
            onChange={(event) => {
              const preset = PRESETS.find((item) => item.id === event.target.value) ?? PRESETS[0];
              setStudio({ presetId: preset.id, spec: preset.spec, payload: preset.payload });
            }}
          >
            {PRESETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <label className="rok-field">
          Height
          <input
            aria-label="Altitude"
            type="range"
            min={sliderMin}
            max={2000}
            step={1}
            value={altitudeKm}
            onChange={(event) => onAltitude(Number(event.target.value))}
          />
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          {PERIODS.map((item) => (
            <button key={item.id} type="button" aria-pressed={period === item.id} onClick={() => setPeriod(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <p data-testid="starmind-radius" data-starmind-radius-km={RE_M / 1000 + altitudeKm}>
          On screen: {altitudeKm.toFixed(0)} km, tilt {inclinationDeg.toFixed(0)}°.
          {shown ? ` About ${shown.years.toFixed(1)} years, ended by ${shown.binding}.` : " May 2024 storm."}
        </p>
        <p data-testid="best-altitude" data-best-altitude-km={best.altitude}>
          {period === "may2024"
            ? `For May 2024 the calmer height is ${best.altitude} km.`
            : `For this period the longest life is at ${best.altitude} km.`}
        </p>
        <table>
          <thead>
            <tr>
              <th>Height</th>
              <th>{period === "may2024" ? "Storm cost" : "Years"}</th>
              <th>{period === "may2024" ? "" : "Ends by"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const life = period === "may2024" ? null : pick(row.impact, period);
              const current = Math.abs(row.altitude - altitudeKm) < 150;
              const chosen = row.altitude === best.altitude;
              return (
                <tr key={row.altitude}>
                  <td>
                    {row.altitude} km{current ? " · on screen" : ""}
                    {chosen ? " · best" : ""}
                  </td>
                  <td>{life ? life.years.toFixed(1) : row.stormCost.toFixed(0)}</td>
                  <td>{life ? life.binding : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button type="button" onClick={useSuggested}>
          Move to this orbit
        </button>
      </section>
    </main>
  );
}
