import { nodalRateRadPerSec } from "@/lib/engine/orbit/sso";
import { wrap360 } from "@/lib/engine/orbit/angles";

/** RAAN after secular J2 drift. Two-body rate, no higher geopotential. */
export function raanAfterSeconds(raanDeg: number, altitudeKm: number, inclinationDeg: number, seconds: number): number {
  const rate = nodalRateRadPerSec(altitudeKm, inclinationDeg);
  return wrap360(raanDeg + (rate * seconds * 180) / Math.PI);
}
