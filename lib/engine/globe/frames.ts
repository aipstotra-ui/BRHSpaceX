// Time and reference frames for the globe. One convention for every 3D marker.
// The package root also loads the WASM build, which imports node:module, so these come from the JS entry points.
import { gstime } from "../../../node_modules/satellite.js/dist/propagation.js";
import { sunPos } from "../../../node_modules/satellite.js/dist/sun.js";

import { RE_M } from "@/lib/engine/orbit/constants";
import type { Vec3 } from "@/lib/engine/orbit/sun";

export const EARTH_RADIUS_KM = RE_M / 1000;

const MS_PER_DAY = 86_400_000;
/** Julian date of the Unix epoch, 1970-01-01T00:00:00Z. */
const JD_UNIX_EPOCH = 2_440_587.5;

/** Julian date (UTC used as UT1; the difference is under 0.9 s). */
export function julianDate(utcMs: number): number {
  return utcMs / MS_PER_DAY + JD_UNIX_EPOCH;
}

/** Greenwich mean sidereal time, radians. IAU 1982 model via satellite.js (Vallado). */
export function gmstRad(utcMs: number): number {
  return gstime(julianDate(utcMs));
}

export interface SunState {
  /** Unit vector from Earth's centre to the Sun, true-of-date equatorial (ECI). */
  unit: Vec3;
  rightAscensionDeg: number;
  declinationDeg: number;
}

/**
 * Sun direction from the Astronomical Almanac low-precision formula (Vallado algorithm 29, via satellite.js).
 * Stated accuracy 0.01° for 1950 to 2050.
 */
export function sunAt(utcMs: number): SunState {
  const { rsun, rtasc, decl } = sunPos(julianDate(utcMs));
  const length = Math.hypot(rsun.x, rsun.y, rsun.z);
  const raDeg = (rtasc * 180) / Math.PI;
  return {
    unit: { x: rsun.x / length, y: rsun.y / length, z: rsun.z / length },
    rightAscensionDeg: ((raDeg % 360) + 360) % 360,
    declinationDeg: (decl * 180) / Math.PI,
  };
}

/**
 * Scene convention, in Earth radii. Matches three.js SphereGeometry UVs with an equirectangular map
 * (longitude −180 at u = 0, 0 at u = 0.5):
 *   scene x =  cos(lat) cos(lon)   (towards lat 0, lon 0)
 *   scene y =  sin(lat)            (north pole up)
 *   scene z = −cos(lat) sin(lon)   (lon 90°E points to −z)
 * Equivalently scene = (X, Z, −Y) for an Earth-fixed (ECEF) vector.
 */
export function geodeticToScene(latDeg: number, lonDeg: number, altKm: number, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const radius = (EARTH_RADIUS_KM + altKm) / EARTH_RADIUS_KM;
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const cosLat = Math.cos(lat);
  out.x = radius * cosLat * Math.cos(lon);
  out.y = radius * Math.sin(lat);
  out.z = -radius * cosLat * Math.sin(lon);
  return out;
}

/** Earth-fixed or inertial kilometres to scene units, same axis map as geodeticToScene. */
export function kmToScene(vectorKm: Vec3, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  out.x = vectorKm.x / EARTH_RADIUS_KM;
  out.y = vectorKm.z / EARTH_RADIUS_KM;
  out.z = -vectorKm.y / EARTH_RADIUS_KM;
  return out;
}

/** Rotate an inertial (ECI) vector into the Earth-fixed frame at the given GMST. */
export function eciToEcef(eci: Vec3, gmst: number, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const c = Math.cos(gmst);
  const s = Math.sin(gmst);
  const x = c * eci.x + s * eci.y;
  const y = -s * eci.x + c * eci.y;
  out.x = x;
  out.y = y;
  out.z = eci.z;
  return out;
}
