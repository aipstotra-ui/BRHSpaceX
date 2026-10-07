import type { OMMJsonObjectV3 } from "satellite.js";
// The package root also loads the WASM build, which imports node:module.
// These JS entry points are the SGP4 implementation the browser worker can run.
import { json2satrec } from "../../../node_modules/satellite.js/dist/io.js";
import { gstime, propagate } from "../../../node_modules/satellite.js/dist/propagation.js";
import { degreesLat, degreesLong, eciToGeodetic } from "../../../node_modules/satellite.js/dist/transforms.js";

export interface GpRecord {
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  BSTAR?: number;
  MEAN_MOTION_DOT?: number;
  MEAN_MOTION_DDOT?: number;
  NORAD_CAT_ID?: number;
  EPHEMERIS_TYPE?: number;
  CLASSIFICATION_TYPE?: string;
  ELEMENT_SET_NO?: number;
  REV_AT_EPOCH?: number;
  OBJECT_NAME?: string;
  OBJECT_ID?: string;
}

export interface GeodeticFix {
  latDeg: number;
  lonDeg: number;
  altKm: number;
}

type SatRec = ReturnType<typeof json2satrec>;

/** Parse GP records once. Records SGP4 cannot initialise are dropped. */
export function satrecsFor(records: GpRecord[]): SatRec[] {
  return records
    .map((record) => json2satrec(record as unknown as OMMJsonObjectV3))
    .filter((satrec) => !satrec.error);
}

function fixFromSatrec(satrec: SatRec, date: Date, gmst: number): GeodeticFix | null {
  const pv = propagate(satrec, date);
  if (!pv || !pv.position || typeof pv.position === "boolean") {
    return null;
  }
  const geo = eciToGeodetic(pv.position, gmst);
  if (!Number.isFinite(geo.height)) {
    return null;
  }
  return {
    latDeg: degreesLat(geo.latitude),
    lonDeg: degreesLong(geo.longitude),
    altKm: geo.height,
  };
}

/** One SGP4 fix from a CelesTrak GP JSON object already in the repo snapshot. */
export function propagateGp(record: GpRecord, date: Date): GeodeticFix | null {
  const satrec = json2satrec(record as unknown as OMMJsonObjectV3);
  if (satrec.error) {
    return null;
  }
  return fixFromSatrec(satrec, date, gstime(date));
}

/** Packed lat, lon, alt triples for every satrec that propagates at this date. */
export function satrecFloats(satrecs: SatRec[], date: Date): Float32Array {
  const out = new Float32Array(satrecs.length * 3);
  const gmst = gstime(date);
  let count = 0;
  for (const satrec of satrecs) {
    const fix = fixFromSatrec(satrec, date, gmst);
    if (!fix) {
      continue;
    }
    out[count * 3] = fix.latDeg;
    out[count * 3 + 1] = fix.lonDeg;
    out[count * 3 + 2] = fix.altKm;
    count += 1;
  }
  return out.slice(0, count * 3);
}

export function starlinkFloats(records: GpRecord[], date: Date): Float32Array {
  return satrecFloats(satrecsFor(records), date);
}
