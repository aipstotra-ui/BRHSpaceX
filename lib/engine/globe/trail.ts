import { exposureClass, exposureCode, type StormContext } from "@/lib/engine/globe/exposure";
import { starmindAtUtc, type StarmindOrbit } from "@/lib/engine/orbit/j2";
import { meanMotionRadS } from "@/lib/engine/orbit/sso";

/** Segments across one orbital period. The one-period length is an estimate. */
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

/**
 * Ground track over the last orbital period, ending exactly at the craft (TRAIL_SAMPLES + 1 points).
 * It is Earth-fixed, so it does not close on itself: Earth turns about 24° under one orbit.
 */
export function starmindTrailAtUtc(orbit: StarmindOrbit, utcMs: number, storm?: StormContext): StarmindSample[] {
  const periodMs = orbitPeriodSeconds(orbit.altitudeKm) * 1000;
  const samples: StarmindSample[] = [];
  for (let index = 0; index <= TRAIL_SAMPLES; index += 1) {
    const at = utcMs - periodMs + (index * periodMs) / TRAIL_SAMPLES;
    const fix = starmindAtUtc(orbit, at);
    samples.push({
      latDeg: fix.latDeg,
      lonDeg: fix.lonDeg,
      altKm: fix.altKm,
      radiusKm: fix.radiusKm,
      code: exposureCode(exposureClass(fix.latDeg, fix.lonDeg, fix.altKm, storm)),
    });
  }
  return samples;
}
