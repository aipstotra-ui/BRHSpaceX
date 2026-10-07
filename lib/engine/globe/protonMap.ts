/**
 * The AP8MIN >10 MeV trapped-proton map built by scripts/orbit/saa_map.py (public/globe/proton-flux-map.json).
 * Bilinear in latitude and longitude, linear in log flux between altitude layers.
 */

export interface ProtonMapFile {
  model: string;
  energyMeV: number;
  unit: string;
  field: { internal: string; external: string; date: string };
  altitudesKm: number[];
  latStartDeg: number;
  latStepDeg: number;
  latCount: number;
  lonStartDeg: number;
  lonStepDeg: number;
  lonCount: number;
  encoding: { logFloor: number; logCeil: number; steps: number };
  log10FluxBase64: string;
}

export interface ProtonMap {
  file: ProtonMapFile;
  /** log10 flux per [altitude][lat][lon]; NaN where the model gives nothing above the floor. */
  logs: Float32Array;
}

/**
 * SAA edge used on the globe: >10 MeV integral flux of 10 /cm2/s. A display choice: at 500 km, inside the
 * latitudes Fermi flies (±26°), this contour matches the Fermi GBM SAA polygon with 0.83 overlap
 * (intersection over union) and 0.98 of its area. South of 30°S the polygon stops (Fermi never goes there);
 * the flux contour does not.
 */
export const SAA_EDGE_FLUX = 10;
export const SAA_EDGE_LOG = Math.log10(SAA_EDGE_FLUX);

export function decodeProtonMap(file: ProtonMapFile): ProtonMap {
  const binary = atob(file.log10FluxBase64);
  const logs = new Float32Array(binary.length);
  const { logFloor, logCeil, steps } = file.encoding;
  for (let index = 0; index < binary.length; index += 1) {
    const q = binary.charCodeAt(index);
    logs[index] = q === 0 ? Number.NaN : logFloor + ((q - 1) / steps) * (logCeil - logFloor);
  }
  return { file, logs };
}

/** Below-floor cells count as the floor for interpolation, so the edge fades instead of jumping. */
function cell(map: ProtonMap, alt: number, lat: number, lon: number): number {
  const { latCount, lonCount, encoding } = map.file;
  const value = map.logs[(alt * latCount + lat) * lonCount + lon];
  return Number.isNaN(value) ? encoding.logFloor : value;
}

function altitudeBracket(altitudesKm: number[], altKm: number): [number, number, number] {
  const last = altitudesKm.length - 1;
  if (altKm <= altitudesKm[0]) {
    return [0, 0, 0];
  }
  if (altKm >= altitudesKm[last]) {
    return [last, last, 0];
  }
  for (let index = 0; index < last; index += 1) {
    if (altKm <= altitudesKm[index + 1]) {
      return [index, index + 1, (altKm - altitudesKm[index]) / (altitudesKm[index + 1] - altitudesKm[index])];
    }
  }
  return [last, last, 0];
}

/** log10 of the >10 MeV flux (1/cm2/s) at a point. Altitude is clamped to the grid (300–1500 km). */
export function protonLogAt(map: ProtonMap, latDeg: number, lonDeg: number, altKm: number): number {
  const { latStartDeg, latStepDeg, latCount, lonStartDeg, lonStepDeg, lonCount } = map.file;
  const y = Math.min(latCount - 1, Math.max(0, (latDeg - latStartDeg) / latStepDeg));
  const y0 = Math.floor(y);
  const y1 = Math.min(latCount - 1, y0 + 1);
  const ty = y - y0;
  let x = (lonDeg - lonStartDeg) / lonStepDeg;
  x = ((x % lonCount) + lonCount) % lonCount;
  const x0 = Math.floor(x);
  const x1 = (x0 + 1) % lonCount;
  const tx = x - x0;
  const [a0, a1, ta] = altitudeBracket(map.file.altitudesKm, altKm);
  const layer = (alt: number) =>
    (cell(map, alt, y0, x0) * (1 - tx) + cell(map, alt, y0, x1) * tx) * (1 - ty) +
    (cell(map, alt, y1, x0) * (1 - tx) + cell(map, alt, y1, x1) * tx) * ty;
  return layer(a0) * (1 - ta) + layer(a1) * ta;
}

export function inSaaFlux(map: ProtonMap, latDeg: number, lonDeg: number, altKm: number): boolean {
  return protonLogAt(map, latDeg, lonDeg, altKm) >= SAA_EDGE_LOG;
}

/**
 * One altitude slice for a texture (row 0 = southernmost latitude): log10 flux mapped linearly from logFloor (0)
 * to logCeil (1).
 */
export function protonLayer(map: ProtonMap, altKm: number, out?: Float32Array): Float32Array {
  const { latCount, lonCount, latStartDeg, latStepDeg, lonStartDeg, lonStepDeg, encoding } = map.file;
  const values = out ?? new Float32Array(latCount * lonCount);
  const span = encoding.logCeil - encoding.logFloor;
  for (let lat = 0; lat < latCount; lat += 1) {
    for (let lon = 0; lon < lonCount; lon += 1) {
      const value = protonLogAt(map, latStartDeg + lat * latStepDeg, lonStartDeg + lon * lonStepDeg, altKm);
      values[lat * lonCount + lon] = Math.min(1, Math.max(0, (value - encoding.logFloor) / span));
    }
  }
  return values;
}
