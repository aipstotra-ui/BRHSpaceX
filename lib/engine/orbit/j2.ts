import { wrap360 } from "@/lib/engine/orbit/angles";
import { EARTH_ROTATION_RAD_S, RE_M } from "@/lib/engine/orbit/constants";
import { circularPositionKm } from "@/lib/engine/orbit/eclipse";
import { groundPoint } from "@/lib/engine/orbit/saa";
import { meanMotionRadS, nodalRateRadPerSec } from "@/lib/engine/orbit/sso";

export interface StarmindFix {
  xKm: number;
  yKm: number;
  zKm: number;
  latDeg: number;
  lonDeg: number;
  altKm: number;
  radiusKm: number;
}

/** RAAN after secular J2 drift. Two-body rate, no higher geopotential. */
export function raanAfterSeconds(raanDeg: number, altitudeKm: number, inclinationDeg: number, seconds: number): number {
  const rate = nodalRateRadPerSec(altitudeKm, inclinationDeg);
  return wrap360(raanDeg + (rate * seconds * 180) / Math.PI);
}

/** Circular J2 position. Argument of latitude starts at 0 at seconds = 0. */
export function starmindPositionKm(
  altitudeKm: number,
  inclinationDeg: number,
  raanDeg: number,
  seconds: number,
): StarmindFix {
  const motion = meanMotionRadS(altitudeKm);
  const raan = raanAfterSeconds(raanDeg, altitudeKm, inclinationDeg, seconds);
  const argumentDeg = (motion * seconds * 180) / Math.PI;
  const radiusKm = RE_M / 1000 + altitudeKm;
  const eci = circularPositionKm(radiusKm, inclinationDeg, raan, argumentDeg);
  const ground = groundPoint(eci, EARTH_ROTATION_RAD_S * seconds);
  return {
    xKm: eci.x,
    yKm: eci.y,
    zKm: eci.z,
    latDeg: ground.latDeg,
    lonDeg: ground.lonDeg,
    altKm: altitudeKm,
    radiusKm,
  };
}
