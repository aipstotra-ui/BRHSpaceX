import { exposureClass, exposureCode, type StormContext } from "@/lib/engine/globe/exposure";
import { starmindAtUtc, type StarmindOrbit } from "@/lib/engine/orbit/j2";
import { meanMotionRadS } from "@/lib/engine/orbit/sso";

/** Ground track length in orbital periods, and the segments it is drawn with. Display choices, not data. */
export const GROUND_TRACK_ORBITS = 1.5;
export const GROUND_TRACK_SAMPLES = 270;

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
 * Ground track over the last GROUND_TRACK_ORBITS periods, oldest first, ending exactly at the craft
 * (GROUND_TRACK_SAMPLES + 1 points). It is Earth-fixed, so it never closes on itself: Earth turns about 24° under
 * one orbit. The closed loop is the orbit ring, drawn in the inertial frame.
 */
export function groundTrackAtUtc(orbit: StarmindOrbit, utcMs: number, storm?: StormContext): StarmindSample[] {
  const spanMs = orbitPeriodSeconds(orbit.altitudeKm) * 1000 * GROUND_TRACK_ORBITS;
  const samples: StarmindSample[] = [];
  for (let index = 0; index <= GROUND_TRACK_SAMPLES; index += 1) {
    const at = utcMs - spanMs + (index * spanMs) / GROUND_TRACK_SAMPLES;
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
