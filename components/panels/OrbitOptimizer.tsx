"use client";

import { useMemo, useState } from "react";

import { OrbitHeatmap } from "@/components/globe/OrbitHeatmap";
import { TransferAnimation } from "@/components/globe/TransferAnimation";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { CLIMATOLOGY_SENTENCE } from "@/lib/engine/orbit/climatology";
import {
  ALTITUDE_STEP_KM,
  DEFAULT_WEIGHTS,
  LTAN_GRID_HOURS,
  rankOrbits,
  type ScoreWeights,
} from "@/lib/engine/orbit/optimizer";
import { useOrbitStore } from "@/lib/store/orbit";
import { useShellStore } from "@/lib/store";

export function OrbitOptimizer() {
  const spec = useShellStore((state) => state.spec);
  const payload = useShellStore((state) => state.payload);
  const vehicle = useOrbitStore((state) => state.vehicle);
  const altitudeKm = useOrbitStore((state) => state.altitudeKm);
  const [weights, setWeights] = useState<ScoreWeights>(DEFAULT_WEIGHTS);

  const ranked = useMemo(
    () =>
      rankOrbits({
        spec,
        payload,
        vehicle,
        weights,
        fromAltitudeKm: altitudeKm,
      }),
    [altitudeKm, payload, spec, vehicle, weights],
  );
  const best = ranked[0];
  const recommendation =
    best === undefined
      ? "Empty"
      : best.altitudeKm > altitudeKm
        ? "raise orbit"
        : best.altitudeKm < altitudeKm
          ? "lower orbit"
          : "hold altitude";

  function setWeight(key: keyof ScoreWeights, value: number) {
    setWeights((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="body">
      <p>{CLIMATOLOGY_SENTENCE}</p>
      <p className="rok-muted">
        Grid step {ALTITUDE_STEP_KM} km and LTAN {LTAN_GRID_HOURS.join(" and ")} h are{" "}
        <SourceBadge label="estimate" />. Weights are <SourceBadge label="estimate" />. Tie-break is lower altitude,
        then lower LTAN.
      </p>
      <OrbitHeatmap rows={ranked} />
      <p>
        Recommendation versus the current orbit: {recommendation}
        {best ? (
          <span data-testid="best-altitude" data-best-altitude-km={best.altitudeKm}>
            . Best {best.altitudeKm} km, lifetime {best.lifetimeYears.toFixed(2)} yr, binding {best.binding}.
          </span>
        ) : null}
      </p>
      {(["upset", "dose", "lifetime", "thermal"] as const).map((key) => (
        <label key={key} className="rok-field">
          {key} weight {weights[key].toFixed(2)}
          <input
            aria-label={`${key} weight`}
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={weights[key]}
            onChange={(event) => setWeight(key, Number(event.target.value))}
          />
        </label>
      ))}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Altitude km</th>
              <th>LTAN h</th>
              <th>Score</th>
              <th>Binding</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((row) => (
              <tr key={`${row.altitudeKm}-${row.ltanHours}`}>
                <td>{row.altitudeKm}</td>
                <td>{row.ltanHours}</td>
                <td>{row.score.toFixed(3)}</td>
                <td>{row.binding}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {best ? <TransferAnimation targetAltitudeKm={best.altitudeKm} targetLtanHours={best.ltanHours} /> : null}
    </div>
  );
}
