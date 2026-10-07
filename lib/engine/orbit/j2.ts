import { wrap360 } from "@/lib/engine/orbit/angles";
import { J2_GEO, RE_M } from "@/lib/engine/orbit/constants";
import { circularPositionKm } from "@/lib/engine/orbit/eclipse";
import { groundPoint } from "@/lib/engine/orbit/saa";
import { meanMotionRadS, nodalRateRadPerSec, raanFromLtan } from "@/lib/engine/orbit/sso";
import { gmstRad, meanSunRightAscensionDeg } from "@/lib/engine/globe/frames";

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

/** The orbit the globe draws. For SSO the RAAN follows from LTAN; otherwise raanDeg holds at ORBIT_EPOCH_MS. */
export interface StarmindOrbit {
  altitudeKm: number;
  inclinationDeg: number;
  sunSynchronous: boolean;
  ltanHours: number | null;
  raanDeg: number;
}

/** J2000 (2000-01-01 12:00 UTC). Reference epoch for RAAN and for argument of latitude 0. Convention, not data. */
export const ORBIT_EPOCH_MS = Date.UTC(2000, 0, 1, 12);

/**
 * RAAN at a UTC time. SSO: the node sits at the requested local mean time, against the mean Sun at that moment.
 * Otherwise: the epoch RAAN drifted by the secular J2 rate.
 */
export function raanAtUtc(orbit: StarmindOrbit, utcMs: number): number {
  if (orbit.sunSynchronous) {
    return raanFromLtan(orbit.ltanHours ?? 6, meanSunRightAscensionDeg(utcMs));
  }
  return raanAfterSeconds(orbit.raanDeg, orbit.altitudeKm, orbit.inclinationDeg, (utcMs - ORBIT_EPOCH_MS) / 1000);
}

/**
 * Rate of the argument of latitude for a circular orbit, rad/s: mean motion plus the secular J2 terms of the mean
 * anomaly and argument of perigee, n (3/4) J2 (Re/a)^2 (8 cos^2 i - 2) (Vallado, Fundamentals of Astrodynamics,
 * secular J2 rates of M and ω with e = 0). Without it the craft drifts about 3° per day along track against SGP4.
 */
export function argumentRateRadPerSec(altitudeKm: number, inclinationDeg: number): number {
  const n = meanMotionRadS(altitudeKm);
  const ratio = RE_M / (RE_M + altitudeKm * 1000);
  const cosI = Math.cos((inclinationDeg * Math.PI) / 180);
  return n * (1 + 0.75 * J2_GEO * ratio * ratio * (8 * cosI * cosI - 2));
}

/** Circular J2 position at an absolute UTC time: inertial position plus the ground point under real GMST. */
export function starmindAtUtc(orbit: StarmindOrbit, utcMs: number): StarmindFix {
  const seconds = (utcMs - ORBIT_EPOCH_MS) / 1000;
  const motion = argumentRateRadPerSec(orbit.altitudeKm, orbit.inclinationDeg);
  const argumentDeg = wrap360((motion * seconds * 180) / Math.PI);
  const radiusKm = RE_M / 1000 + orbit.altitudeKm;
  const eci = circularPositionKm(radiusKm, orbit.inclinationDeg, raanAtUtc(orbit, utcMs), argumentDeg);
  const ground = groundPoint(eci, gmstRad(utcMs));
  return {
    xKm: eci.x,
    yKm: eci.y,
    zKm: eci.z,
    latDeg: ground.latDeg,
    lonDeg: ground.lonDeg,
    altKm: orbit.altitudeKm,
    radiusKm,
  };
}
