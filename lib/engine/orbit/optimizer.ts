import type { ChipSpec, PayloadConfig } from "@/lib/types";

import { getPreset } from "@/lib/presets";
import {
  FCC_ALT_MAX_KM,
  FCC_ALT_MIN_KM,
  VEHICLE_CD,
  VEHICLE_DRAG_AREA_M2,
  VEHICLE_EOL_KM,
  VEHICLE_MASS_KG,
} from "@/lib/engine/orbit/constants";
import { hohmannDeltaVMs } from "@/lib/engine/orbit/hohmann";
import type { Vehicle } from "@/lib/engine/orbit/lifetime";
import { orbitImpact } from "@/lib/engine/orbitImpact";
import { ssoInclinationDeg } from "@/lib/engine/orbit/sso";

/** estimate: grid and weights are design choices, shown in the UI. */
export const ALTITUDE_STEP_KM = 300;
export const LTAN_GRID_HOURS = [6, 12] as const;

export interface ScoreWeights {
  upset: number;
  dose: number;
  lifetime: number;
  thermal: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  upset: 0.35,
  dose: 0.25,
  lifetime: 0.3,
  thermal: 0.1,
};

export interface OrbitCandidate {
  altitudeKm: number;
  inclinationDeg: number;
  ltanHours: number;
  upsetPerYear: number;
  annualDose: number;
  lifetimeYears: number;
  tidYears: number;
  thermalMarginC: number;
  binding: string;
  score: number;
  deltaVMs: number;
}

export interface RankOptions {
  spec: ChipSpec;
  payload: PayloadConfig;
  vehicle: Vehicle;
  weights?: ScoreWeights;
  fromAltitudeKm?: number;
  memoryUnit?: "GB" | "KB";
  nodeKnown?: boolean;
}

function altitudes(): number[] {
  const values: number[] = [];
  for (let altitude = FCC_ALT_MIN_KM; altitude <= FCC_ALT_MAX_KM; altitude += ALTITUDE_STEP_KM) {
    values.push(altitude);
  }
  return values;
}

function unitInterval(value: number, low: number, high: number): number {
  if (high === low) {
    return 0;
  }
  return (value - low) / (high - low);
}

function compareRank(left: OrbitCandidate, right: OrbitCandidate): number {
  if (left.score !== right.score) {
    return left.score - right.score;
  }
  if (left.altitudeKm !== right.altitudeKm) {
    return left.altitudeKm - right.altitudeKm;
  }
  return left.ltanHours - right.ltanHours;
}

export function rankOrbits(chip: RankOptions): OrbitCandidate[] {
  const weights = chip.weights ?? DEFAULT_WEIGHTS;
  const fromAltitude = chip.fromAltitudeKm ?? FCC_ALT_MIN_KM;
  const measured = altitudes().flatMap((altitudeKm) =>
    LTAN_GRID_HOURS.map((ltanHours) => {
      const impact = orbitImpact({
        altitudeKm,
        inclinationDeg: ssoInclinationDeg(altitudeKm),
        sunSynchronous: true,
        ltanHours,
        raanDeg: 0,
        vehicle: chip.vehicle,
        spec: chip.spec,
        payload: chip.payload,
        memoryUnit: chip.memoryUnit,
        nodeKnown: chip.nodeKnown,
      });
      const upsetPerYear = impact.upsetRate.mid * 365.25 * 86400;
      return {
        altitudeKm,
        inclinationDeg: ssoInclinationDeg(altitudeKm),
        ltanHours,
        upsetPerYear,
        annualDose: impact.annualDose.mid,
        lifetimeYears: impact.lifetimeYears.mid,
        tidYears: impact.tidYears.mid,
        thermalMarginC: impact.thermalMarginC.mid,
        binding: impact.binding,
        score: 0,
        deltaVMs: hohmannDeltaVMs(fromAltitude, altitudeKm),
      };
    }),
  );

  const upset = measured.map((row) => row.upsetPerYear);
  const dose = measured.map((row) => row.annualDose);
  const life = measured.map((row) => row.lifetimeYears);
  const thermal = measured.map((row) => Math.max(0, -row.thermalMarginC));
  const scored = measured.map((row) => {
    const score =
      weights.upset * unitInterval(row.upsetPerYear, Math.min(...upset), Math.max(...upset)) +
      weights.dose * unitInterval(row.annualDose, Math.min(...dose), Math.max(...dose)) +
      weights.lifetime * (1 - unitInterval(row.lifetimeYears, Math.min(...life), Math.max(...life))) +
      weights.thermal * unitInterval(Math.max(0, -row.thermalMarginC), Math.min(...thermal), Math.max(...thermal));
    return { ...row, score };
  });
  scored.sort(compareRank);
  return scored;
}

export function defaultRankOptions(): RankOptions {
  const preset = getPreset("ai1-spacex");
  return {
    spec: preset.spec,
    payload: preset.payload,
    vehicle: {
      massKg: VEHICLE_MASS_KG,
      dragAreaM2: VEHICLE_DRAG_AREA_M2,
      cd: VEHICLE_CD,
      eolAltitudeKm: VEHICLE_EOL_KM,
    },
    memoryUnit: preset.memoryUnit,
    nodeKnown: preset.nodeKnown,
  };
}
