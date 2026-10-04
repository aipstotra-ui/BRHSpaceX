import { RE_M } from "@/lib/engine/orbit/constants";

/** Scene units are kilometres. Y is geographic north. */
export const EARTH_RADIUS_KM = RE_M / 1000;

export function latLngAltToKm(latDeg: number, lngDeg: number, altKm: number): [number, number, number] {
  const radius = EARTH_RADIUS_KM + altKm;
  const phi = ((90 - latDeg) * Math.PI) / 180;
  const theta = ((lngDeg + 180) * Math.PI) / 180;
  const sinPhi = Math.sin(phi);
  return [-radius * sinPhi * Math.cos(theta), radius * Math.cos(phi), radius * sinPhi * Math.sin(theta)];
}

export function orbitRadiusKm(altitudeKm: number): number {
  return EARTH_RADIUS_KM + altitudeKm;
}
