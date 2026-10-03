import { inSaa } from "@/lib/engine/radiation";

import { wrap180 } from "@/lib/engine/orbit/angles";
import type { Vec3 } from "@/lib/engine/orbit/sun";

export function groundPoint(positionKm: Vec3, earthAngleRad: number): { latDeg: number; lonDeg: number } {
  const radius = Math.hypot(positionKm.x, positionKm.y, positionKm.z);
  const latDeg = (Math.asin(positionKm.z / radius) * 180) / Math.PI;
  const inertialLon = (Math.atan2(positionKm.y, positionKm.x) * 180) / Math.PI;
  const earthDeg = (earthAngleRad * 180) / Math.PI;
  return { latDeg, lonDeg: wrap180(inertialLon - earthDeg) };
}

/** Geographic point-in-polygon against the Fermi GBM ring. The ring is not altitude-dependent. */
export function inSaaGeographic(latDeg: number, lonDeg: number): boolean {
  return inSaa(latDeg, lonDeg);
}
