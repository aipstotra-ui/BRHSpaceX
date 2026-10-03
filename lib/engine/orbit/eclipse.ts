import { rad } from "@/lib/engine/orbit/angles";
import { SHADOW_AU_KM, SHADOW_RE_KM, SHADOW_RS_KM, VALLADO_SHADOW_URL } from "@/lib/engine/orbit/constants";
import type { Vec3 } from "@/lib/engine/orbit/sun";

export const ECLIPSE_SOURCE = VALLADO_SHADOW_URL;

const ANG_UMB = Math.atan((SHADOW_RS_KM - SHADOW_RE_KM) / SHADOW_AU_KM);
const ANG_PEN = Math.atan((SHADOW_RS_KM + SHADOW_RE_KM) / SHADOW_AU_KM);

export type ShadowKind = "sun" | "penumbra" | "umbra";

function mag(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Vallado algorithm 34 conical shadow.
 * Positions are kilometres. Umbra is the eclipse state used for the fraction.
 * The shadow Earth radius is Vallado's 6378.1363 km, not the WGS 84 element radius.
 */
export function shadowKind(reciKm: Vec3, rsunKm: Vec3): ShadowKind {
  if (dot(reciKm, rsunKm) >= 0) {
    return "sun";
  }
  const reciMag = mag(reciKm);
  const sunMag = mag(rsunKm);
  const ang1 = Math.acos(Math.min(1, Math.max(-1, dot({ x: -rsunKm.x, y: -rsunKm.y, z: -rsunKm.z }, reciKm) / (sunMag * reciMag))));
  const satHoriz = reciMag * Math.cos(ang1);
  const satVert = reciMag * Math.sin(ang1);
  const penVert = Math.tan(ANG_PEN) * (SHADOW_RE_KM / Math.sin(ANG_PEN) + satHoriz);
  if (satVert > penVert) {
    return "sun";
  }
  const umbVert = Math.tan(ANG_UMB) * (SHADOW_RE_KM / Math.sin(ANG_UMB) - satHoriz);
  if (satVert <= umbVert) {
    return "umbra";
  }
  return "penumbra";
}

export function circularPositionKm(
  radiusKm: number,
  inclinationDeg: number,
  raanDeg: number,
  argumentDeg: number,
): Vec3 {
  const i = rad(inclinationDeg);
  const omega = rad(raanDeg);
  const u = rad(argumentDeg);
  const cosO = Math.cos(omega);
  const sinO = Math.sin(omega);
  const cosU = Math.cos(u);
  const sinU = Math.sin(u);
  const cosI = Math.cos(i);
  const sinI = Math.sin(i);
  return {
    x: radiusKm * (cosO * cosU - sinO * sinU * cosI),
    y: radiusKm * (sinO * cosU + cosO * sinU * cosI),
    z: radiusKm * sinU * sinI,
  };
}
