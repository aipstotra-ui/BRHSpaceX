import contour from "@/data/orbit/saa_igrf14.json";

export const SAA_THRESHOLD_NT = 25000;
export const SAA_MODEL = "IGRF-14";
export const SAA_CITATION = "https://ntrs.nasa.gov/api/citations/20000013569/downloads/20000013569.pdf";

interface SaaLayer {
  altitudeKm: number;
  gridStepDeg: number;
  gridLat0: number;
  gridLon0: number;
  gridNLat: number;
  gridNLon: number;
  mask: string;
  rings: number[][][];
}

const layers = contour.altitudes as SaaLayer[];
const decoded = new Map<number, Uint8Array>();

function maskBits(layer: SaaLayer): Uint8Array {
  const cached = decoded.get(layer.altitudeKm);
  if (cached) {
    return cached;
  }
  const binary = globalThis.atob(layer.mask);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  decoded.set(layer.altitudeKm, bytes);
  return bytes;
}

export function nearestSaaAltitudeKm(altitudeKm: number): number {
  let best = layers[0].altitudeKm;
  let bestDistance = Math.abs(altitudeKm - best);
  for (const layer of layers) {
    const distance = Math.abs(altitudeKm - layer.altitudeKm);
    if (distance < bestDistance) {
      best = layer.altitudeKm;
      bestDistance = distance;
    }
  }
  return best;
}

export function saaLayer(altitudeKm: number): SaaLayer {
  const nearest = nearestSaaAltitudeKm(altitudeKm);
  return layers.find((layer) => layer.altitudeKm === nearest) ?? layers[0];
}

function wrapLon(lonDeg: number): number {
  let lon = lonDeg;
  while (lon > 180) {
    lon -= 360;
  }
  while (lon < -180) {
    lon += 360;
  }
  return lon;
}

/** Nearest cell on the precomputed |B| < 25,000 nT mask. Not an IGRF evaluation. */
export function inSaaContour(latDeg: number, lonDeg: number, altitudeKm: number): boolean {
  const layer = saaLayer(altitudeKm);
  const latIndex = Math.round((latDeg - layer.gridLat0) / layer.gridStepDeg);
  const lonIndex = Math.round((wrapLon(lonDeg) - layer.gridLon0) / layer.gridStepDeg);
  const i = Math.max(0, Math.min(layer.gridNLat - 1, latIndex));
  const j = Math.max(0, Math.min(layer.gridNLon - 1, lonIndex));
  const bitIndex = i * layer.gridNLon + j;
  const byte = maskBits(layer)[bitIndex >> 3] ?? 0;
  return ((byte >> (7 - (bitIndex & 7))) & 1) === 1;
}

export function saaRings(altitudeKm: number): number[][][] {
  return saaLayer(altitudeKm).rings;
}

export interface SaaGrid {
  altitudeKm: number;
  stepDeg: number;
  lat0: number;
  lon0: number;
  nLat: number;
  nLon: number;
  bits: Uint8Array;
}

export function saaGrid(altitudeKm: number): SaaGrid {
  const layer = saaLayer(altitudeKm);
  return {
    altitudeKm: layer.altitudeKm,
    stepDeg: layer.gridStepDeg,
    lat0: layer.gridLat0,
    lon0: layer.gridLon0,
    nLat: layer.gridNLat,
    nLon: layer.gridNLon,
    bits: maskBits(layer),
  };
}

export function saaBit(grid: SaaGrid, latIndex: number, lonIndex: number): boolean {
  const bitIndex = latIndex * grid.nLon + lonIndex;
  const byte = grid.bits[bitIndex >> 3] ?? 0;
  return ((byte >> (7 - (bitIndex & 7))) & 1) === 1;
}
