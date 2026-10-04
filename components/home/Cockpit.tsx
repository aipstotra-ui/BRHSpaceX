"use client";

import { useMemo, useState } from "react";

import { Globe } from "@/components/globe/Globe";
import { cheapestAction } from "@/lib/engine/costCheck";
import { RE_M } from "@/lib/engine/orbit/constants";
import { DERIVED_SHELL } from "@/lib/engine/orbit/derivedShell";
import { orbitImpact } from "@/lib/engine/orbitImpact";
import { rankOrbits } from "@/lib/engine/orbit/optimizer";
import { replayOnOrbit } from "@/lib/engine/replayOnOrbit";
import { fccAltitudeSchema } from "@/lib/engine/orbit/schema";
import { PRESETS } from "@/lib/presets";
import { useShellStore } from "@/lib/store";
import { useOrbitStore } from "@/lib/store/orbit";

function why(binding: string): string {
  if (binding === "drag") {
    return "This orbit falls back toward Earth before radiation wears out the chip.";
  }
  if (binding === "TID") {
    return "Radiation reaches the chip's limit before the orbit falls.";
  }
  return "Radiation wear and falling back down happen about together.";
}

export function Cockpit() {
  const presetId = useShellStore((state) => state.presetId);
  const spec = useShellStore((state) => state.spec);
  const payload = useShellStore((state) => state.payload);
  const setStudio = useShellStore((state) => state.setStudio);
  const altitudeKm = useOrbitStore((state) => state.altitudeKm);
  const inclinationDeg = useOrbitStore((state) => state.inclinationDeg);
  const sunSynchronous = useOrbitStore((state) => state.sunSynchronous);
  const vehicle = useOrbitStore((state) => state.vehicle);
  const setAltitudeKm = useOrbitStore((state) => state.setAltitudeKm);
  const setSunSynchronous = useOrbitStore((state) => state.setSunSynchronous);
  const setLtanHours = useOrbitStore((state) => state.setLtanHours);
  const [replay, setReplay] = useState(false);

  const ranked = useMemo(
    () => rankOrbits({ spec, payload, vehicle, fromAltitudeKm: altitudeKm }),
    [altitudeKm, payload, spec, vehicle],
  );
  const best = ranked[0];
  const here = useMemo(
    () =>
      orbitImpact({
        altitudeKm,
        inclinationDeg,
        sunSynchronous,
        ltanHours: sunSynchronous ? 6 : null,
        raanDeg: 0,
        vehicle,
        spec,
        payload,
      }),
    [altitudeKm, inclinationDeg, payload, spec, sunSynchronous, vehicle],
  );
  const stormMove = cheapestAction(8, Math.min(0.4, Math.max(0.02, 0.35 - altitudeKm / 8000)), 1);
  const replayResult = replay ? replayOnOrbit(altitudeKm) : null;
  const sliderMin = altitudeKm < 500 ? Math.floor(altitudeKm) : 500;

  function useSuggested() {
    if (!best) {
      return;
    }
    setSunSynchronous(true);
    setAltitudeKm(best.altitudeKm);
    setLtanHours(best.ltanHours);
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
        <h1 className="heading-md">Where should it fly?</h1>
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
        <p data-testid="starmind-radius" data-starmind-radius-km={RE_M / 1000 + altitudeKm}>
          On screen: {altitudeKm.toFixed(0)} km, tilt {inclinationDeg.toFixed(0)}°. About{" "}
          {here.lifetimeYears.mid.toFixed(1)} years. {why(here.binding)}
        </p>
        {best ? (
          <p data-testid="best-altitude" data-best-altitude-km={best.altitudeKm}>
            Suggested: {best.altitudeKm.toFixed(0)} km, tilt {best.inclinationDeg.toFixed(0)}°. About{" "}
            {best.lifetimeYears.toFixed(1)} years. {why(best.binding)}
          </p>
        ) : null}
        <p>If a strong storm hits: {replayResult?.chosen.actions.find((action) => action !== "continue") ?? stormMove}.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          <button type="button" onClick={useSuggested}>
            Move to this orbit
          </button>
          <button type="button" aria-pressed={replay} onClick={() => setReplay((on) => !on)}>
            Replay May 2024
          </button>
        </div>
        {replayResult ? (
          <p>
            In May 2024 the first change is {replayResult.firstNonContinue}. Compared with the starting height, the
            storm cost is {replayResult.delta.cost < 0 ? "lower" : replayResult.delta.cost > 0 ? "higher" : "the same"}.
          </p>
        ) : (
          <p>The move on screen is a sketch, not a flight plan.</p>
        )}
      </section>
    </main>
  );
}
