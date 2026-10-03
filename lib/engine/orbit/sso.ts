import { deg, rad, wrap360 } from "@/lib/engine/orbit/angles";
import { J2_GEO, J2_URL, MU_M3_S2, RE_M, SSO_RATE_DEG_PER_DAY, SSO_URL } from "@/lib/engine/orbit/constants";

export const SSO_FORMULA_NOTE =
  "Circular J2 condition dΩ/dt = −3 n J2 R_E^2 cos i / (2 a^2), set equal to 0.9856 deg/day. e = 0. J2 is J2geo.";

export function semiMajorM(altitudeKm: number): number {
  return RE_M + altitudeKm * 1000;
}

export function meanMotionRadS(altitudeKm: number): number {
  const a = semiMajorM(altitudeKm);
  return Math.sqrt(MU_M3_S2 / (a * a * a));
}

/** Secular nodal rate, rad/s. Circular orbit, J2 only. */
export function nodalRateRadPerSec(altitudeKm: number, inclinationDeg: number): number {
  const a = semiMajorM(altitudeKm);
  const n = meanMotionRadS(altitudeKm);
  const cosI = Math.cos(rad(inclinationDeg));
  return (-3 * n * J2_GEO * RE_M * RE_M * cosI) / (2 * a * a);
}

/** Inclination that matches the sourced solar rate. Retrograde, above 90°. */
export function ssoInclinationDeg(altitudeKm: number): number {
  const a = semiMajorM(altitudeKm);
  const n = meanMotionRadS(altitudeKm);
  const solar = (SSO_RATE_DEG_PER_DAY * Math.PI) / 180 / 86400;
  const denom = (1.5 * n * J2_GEO * RE_M * RE_M) / (a * a);
  const cosI = Math.min(1, Math.max(-1, -solar / denom));
  return deg(Math.acos(cosI));
}

/**
 * RAAN that puts the ascending node at the requested local time of the node.
 * LTAN 12 aligns the node with the sun. LTAN 6 is 90° behind that sun right ascension.
 * The sun right ascension itself uses the labeled obliquity estimate.
 */
export function raanFromLtan(ltanHours: number, sunRightAscensionDeg: number): number {
  return wrap360(sunRightAscensionDeg + (ltanHours - 12) * 15);
}

export const SSO_SOURCES = [SSO_URL, J2_URL] as const;
