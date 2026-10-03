import { dipoleL } from "@/lib/engine/radiation";

import { rad } from "@/lib/engine/orbit/angles";
import {
  AURORAL_LAT_MAX_DEG,
  AURORAL_LAT_MIN_DEG,
  OUTER_BELT_L_MAX,
  OUTER_BELT_L_MIN,
  RE_M,
} from "@/lib/engine/orbit/constants";

/**
 * Dipole L using geographic latitude as a stand-in for magnetic latitude.
 * That substitution is an estimate. This is not the UNILIB drift-shell L_m.
 */
export function geographicDipoleL(radiusM: number, latitudeDeg: number): number {
  return dipoleL(radiusM / RE_M, rad(latitudeDeg));
}

export function inAuroralZone(latitudeDeg: number): boolean {
  const abs = Math.abs(latitudeDeg);
  return abs >= AURORAL_LAT_MIN_DEG && abs <= AURORAL_LAT_MAX_DEG;
}

export function inOuterBelt(lValue: number): boolean {
  return lValue >= OUTER_BELT_L_MIN && lValue <= OUTER_BELT_L_MAX;
}
