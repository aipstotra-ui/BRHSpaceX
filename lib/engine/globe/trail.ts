import { exposureClass, exposureCode } from "@/lib/engine/globe/exposure";
import { starmindPositionKm } from "@/lib/engine/orbit/j2";
import { meanMotionRadS } from "@/lib/engine/orbit/sso";

/** Samples across one orbital period. The one-period length is an estimate. */
export const TRAIL_SAMPLES = 180;

export interface StarmindSample {
  latDeg: number;
  lonDeg: number;
  altKm: number;
  radiusKm: number;
  code: number;
}

export function orbitPeriodSeconds(altitudeKm: number): number {
  return (2 * Math.PI) / meanMotionRadS(altitudeKm);
}

export function starmindTrail(
  altitudeKm: number,
  inclinationDeg: number,
  raanDeg: number,
  epochSeconds: number,
): StarmindSample[] {
  const period = orbitPeriodSeconds(altitudeKm);
  const samples: StarmindSample[] = [];
  for (let index = 0; index < TRAIL_SAMPLES; index += 1) {
    const seconds = epochSeconds - period + (index * period) / TRAIL_SAMPLES;
    const fix = starmindPositionKm(altitudeKm, inclinationDeg, raanDeg, seconds);
    samples.push({
      latDeg: fix.latDeg,
      lonDeg: fix.lonDeg,
      altKm: fix.altKm,
      radiusKm: fix.radiusKm,
      code: exposureCode(exposureClass(fix.latDeg, fix.lonDeg, fix.altKm)),
    });
  }
  return samples;
}
