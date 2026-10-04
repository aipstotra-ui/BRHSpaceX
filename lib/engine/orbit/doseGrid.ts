import table from "@/data/orbit/dose_table.json";

/**
 * R1 trapped-radiation grid built by scripts/orbit/dose_table.py (AP8/AE8 + SHIELDOSE-2).
 * Axes: solar phase × altitude × inclination (× shielding depth for dose).
 */
export type SolarPhase = "min" | "max";

interface ComputedGrid {
  mode: "computed";
  model: string;
  unit: string;
  upsetUnit: string;
  upsetThresholdMeV: number;
  phases: SolarPhase[];
  altitudesKm: number[];
  inclinationsDeg: number[];
  depthsMmAl: number[];
  doseRadSiPerYear: Record<SolarPhase, number[][][]>;
  protonShare: Record<SolarPhase, number[][][]>;
  protonFluxAboveThreshold: Record<SolarPhase, number[][]>;
  notes: string[];
}

const FLOOR = 1e-30;

function computed(): ComputedGrid | null {
  const raw = table as unknown as { mode?: string };
  return raw.mode === "computed" ? (raw as ComputedGrid) : null;
}

export function doseGridAvailable(): boolean {
  return computed() !== null;
}

export function doseGridModel(): string | null {
  return computed()?.model ?? null;
}

export function doseGridNotes(): string[] {
  return computed()?.notes ?? [];
}

export function doseGridDepthRange(): { min: number; max: number } | null {
  const grid = computed();
  if (!grid) {
    return null;
  }
  return { min: grid.depthsMmAl[0], max: grid.depthsMmAl[grid.depthsMmAl.length - 1] };
}

function bracket(axis: number[], value: number): [number, number, number] {
  const clamped = Math.min(Math.max(value, axis[0]), axis[axis.length - 1]);
  for (let index = 0; index < axis.length - 1; index += 1) {
    if (axis[index] <= clamped && clamped <= axis[index + 1]) {
      const span = axis[index + 1] - axis[index];
      return [index, index + 1, span === 0 ? 0 : (clamped - axis[index]) / span];
    }
  }
  return [axis.length - 1, axis.length - 1, 0];
}

/** Retrograde orbits see the same latitudes as their prograde mirror. */
export function foldInclination(inclinationDeg: number): number {
  return inclinationDeg > 90 ? 180 - inclinationDeg : inclinationDeg;
}

/** Orbit-averaged trapped dose, rad(Si)/yr. Interpolation is log-linear, matching dose_table.py `_lookup`. */
export function gridDoseRadPerYear(phase: SolarPhase, altitudeKm: number, inclinationDeg: number, depthMmAl: number): number {
  const grid = computed();
  if (!grid) {
    return Number.NaN;
  }
  const values = grid.doseRadSiPerYear[phase];
  const [a0, a1, ta] = bracket(grid.altitudesKm, altitudeKm);
  const [i0, i1, ti] = bracket(grid.inclinationsDeg, foldInclination(inclinationDeg));
  const [d0, d1, td] = bracket(grid.depthsMmAl, depthMmAl);
  let sum = 0;
  for (const [ai, wa] of [[a0, 1 - ta], [a1, ta]] as const) {
    for (const [ii, wi] of [[i0, 1 - ti], [i1, ti]] as const) {
      for (const [di, wd] of [[d0, 1 - td], [d1, td]] as const) {
        const weight = wa * wi * wd;
        if (weight) {
          sum += weight * Math.log(Math.max(values[ai][ii][di], FLOOR));
        }
      }
    }
  }
  return Math.exp(sum);
}

/** Orbit-averaged omnidirectional trapped-proton flux above the upset threshold, 1/cm2/s. */
export function gridUpsetFlux(phase: SolarPhase, altitudeKm: number, inclinationDeg: number): number {
  const grid = computed();
  if (!grid) {
    return Number.NaN;
  }
  const values = grid.protonFluxAboveThreshold[phase];
  const [a0, a1, ta] = bracket(grid.altitudesKm, altitudeKm);
  const [i0, i1, ti] = bracket(grid.inclinationsDeg, foldInclination(inclinationDeg));
  let sum = 0;
  for (const [ai, wa] of [[a0, 1 - ta], [a1, ta]] as const) {
    for (const [ii, wi] of [[i0, 1 - ti], [i1, ti]] as const) {
      const weight = wa * wi;
      if (weight) {
        sum += weight * Math.log(Math.max(values[ai][ii], FLOOR));
      }
    }
  }
  return Math.exp(sum);
}

export function gridUpsetThresholdMeV(): number | null {
  return computed()?.upsetThresholdMeV ?? null;
}
