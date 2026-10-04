import { MU_M3_S2, RE_M } from "@/lib/engine/orbit/constants";

/** Shown with every transfer. Plane change, LTAN change, and drag are ignored. */
export const HOHMANN_LABEL =
  "coplanar Hohmann estimate; ignores plane/LTAN change and drag; not a maneuver plan";

function radiusM(altitudeKm: number): number {
  return RE_M + altitudeKm * 1000;
}

/**
 * Coplanar Hohmann Δv in m/s between two circular altitudes.
 * Δv1 = √(μ/r1)·(√(2r2/(r1+r2)) − 1)
 * Δv2 = √(μ/r2)·(1 − √(2r1/(r1+r2)))
 * The signs follow the raising case. The total uses absolute burns, so
 * lowering returns the same total as raising.
 */
export function hohmannDeltaVMs(fromAltitudeKm: number, toAltitudeKm: number): number {
  if (fromAltitudeKm === toAltitudeKm) {
    return 0;
  }
  const r1 = radiusM(fromAltitudeKm);
  const r2 = radiusM(toAltitudeKm);
  const dv1 = Math.sqrt(MU_M3_S2 / r1) * (Math.sqrt((2 * r2) / (r1 + r2)) - 1);
  const dv2 = Math.sqrt(MU_M3_S2 / r2) * (1 - Math.sqrt((2 * r1) / (r1 + r2)));
  return Math.abs(dv1) + Math.abs(dv2);
}
