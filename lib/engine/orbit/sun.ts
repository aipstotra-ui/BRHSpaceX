import { deg, rad } from "@/lib/engine/orbit/angles";
import { ECLIPTIC_SAMPLES, OBLIQUITY_DEG, SHADOW_AU_KM } from "@/lib/engine/orbit/constants";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Sun direction from ecliptic longitude and a fixed obliquity.
 * NOAA names Meeus and does not print the series, so those coefficients are not used.
 * Obliquity 23.439° is an estimate.
 */
export function sunUnit(eclipticLongitudeDeg: number): Vec3 {
  const lambda = rad(eclipticLongitudeDeg);
  const epsilon = rad(OBLIQUITY_DEG);
  return {
    x: Math.cos(lambda),
    y: Math.sin(lambda) * Math.cos(epsilon),
    z: Math.sin(lambda) * Math.sin(epsilon),
  };
}

export function sunRightAscensionDeg(eclipticLongitudeDeg: number): number {
  const sun = sunUnit(eclipticLongitudeDeg);
  return deg(Math.atan2(sun.y, sun.x));
}

export function sunVectorKm(eclipticLongitudeDeg: number): Vec3 {
  const unit = sunUnit(eclipticLongitudeDeg);
  return {
    x: unit.x * SHADOW_AU_KM,
    y: unit.y * SHADOW_AU_KM,
    z: unit.z * SHADOW_AU_KM,
  };
}

export function eclipticLongitudes(): number[] {
  const step = 360 / ECLIPTIC_SAMPLES;
  return Array.from({ length: ECLIPTIC_SAMPLES }, (_, index) => index * step);
}
