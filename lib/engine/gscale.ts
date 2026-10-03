/**
 * NOAA G-scale from Kp.
 * Thresholds: G1 = Kp 5, G2 = 6, G3 = 7, G4 = 8, G5 = 9.
 * Source: https://www.spaceweather.gov/noaa-scales-explanation
 *
 * estimate: thirds below an integer stay below that integer's level, so 4.67 is G0.
 */
export type ThirdsMode = "numeric-threshold";

export const DEFAULT_THIRDS_MODE: ThirdsMode = "numeric-threshold";

const G_LEVELS = [
  { level: 5, minKp: 9 },
  { level: 4, minKp: 8 },
  { level: 3, minKp: 7 },
  { level: 2, minKp: 6 },
  { level: 1, minKp: 5 },
] as const;

export function gscale(kp: number, thirds: ThirdsMode = DEFAULT_THIRDS_MODE): string {
  if (thirds !== "numeric-threshold") {
    throw new Error("unsupported thirds mode");
  }
  if (!Number.isFinite(kp)) {
    return "G0";
  }
  for (const step of G_LEVELS) {
    if (kp >= step.minKp) {
      return `G${step.level}`;
    }
  }
  return "G0";
}
