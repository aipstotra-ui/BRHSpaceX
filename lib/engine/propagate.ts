import {
  degreesLat,
  degreesLong,
  eciToGeodetic,
  gstime,
  json2satrec,
  propagate,
  type SatRec,
} from "satellite.js";

export type OmmRecord = Parameters<typeof json2satrec>[0];

import { EARTH_ROTATION_RAD_S, RE_M } from "@/lib/engine/orbit/constants";
import { circularElements, type OrbitRequest } from "@/lib/engine/orbit/elements";
import { circularPositionKm } from "@/lib/engine/orbit/eclipse";
import { raanAfterSeconds } from "@/lib/engine/orbit/j2";
import { geographicDipoleL, inAuroralZone, inOuterBelt } from "@/lib/engine/orbit/lshell";
import { groundPoint } from "@/lib/engine/orbit/saa";
import { inSaaContour } from "@/lib/engine/saaContour";

export type ExposureClass = "SAA" | "auroral" | "outer" | "nominal";

/** One revolution of ground track. The length is an estimate. */
export const TRAIL_ORBIT_FRACTION = 1;
export const TRAIL_SAMPLES = 180;

/** Slider redraw debounce. An estimate. */
export const ORBIT_REDRAW_DEBOUNCE_MS = 150;

export const PROPAGATE_HZ = 1.5;

export interface GeoSample {
  latDeg: number;
  lngDeg: number;
  altKm: number;
}

export interface StarmindSample extends GeoSample {
  xKm: number;
  yKm: number;
  zKm: number;
  radiusKm: number;
  raanDeg: number;
  argumentDeg: number;
}

export interface TrailSample extends GeoSample {
  exposure: ExposureClass;
}

export interface PropagateRequest {
  epochMs: number;
  originMs: number;
  orbit: OrbitRequest;
  records?: OmmRecord[];
}

export interface PropagateResult {
  epochMs: number;
  ms: number;
  positions: Float32Array;
  starmind: StarmindSample;
  trail: TrailSample[];
}

export interface PropagateState {
  satrecs: SatRec[] | null;
  key: string;
}

export function createPropagateState(): PropagateState {
  return { satrecs: null, key: "" };
}

/**
 * SAA is the IGRF-14 |B| < 25,000 nT contour at the nearest precomputed altitude.
 * Auroral and outer-belt tests are the M5 geographic bands.
 * Priority: SAA, then auroral, then outer belt, then nominal.
 */
export function exposureClass(latDeg: number, lonDeg: number, altitudeKm: number): ExposureClass {
  if (inSaaContour(latDeg, lonDeg, altitudeKm)) {
    return "SAA";
  }
  if (inAuroralZone(latDeg)) {
    return "auroral";
  }
  const radiusM = RE_M + altitudeKm * 1000;
  if (inOuterBelt(geographicDipoleL(radiusM, latDeg))) {
    return "outer";
  }
  return "nominal";
}

export function propagateOmm(record: OmmRecord, date: Date): GeoSample | null {
  return propagateSatrec(json2satrec(record), date);
}

export function propagateSatrec(satrec: SatRec, date: Date): GeoSample | null {
  const propagated = propagate(satrec, date);
  const position = propagated?.position;
  if (position == null || typeof position !== "object") {
    return null;
  }
  const geodetic = eciToGeodetic(position, gstime(date));
  return {
    latDeg: degreesLat(geodetic.latitude),
    lngDeg: degreesLong(geodetic.longitude),
    altKm: geodetic.height,
  };
}

export function starmindAt(request: OrbitRequest, seconds: number): StarmindSample {
  const elements = circularElements(request, 0);
  const raanDeg = raanAfterSeconds(elements.raanDeg, elements.altitudeKm, elements.inclinationDeg, seconds);
  const argumentDeg = ((seconds / elements.periodS) * 360 + 360) % 360;
  const radiusKm = elements.semiMajorM / 1000;
  const position = circularPositionKm(radiusKm, elements.inclinationDeg, raanDeg, argumentDeg);
  const ground = groundPoint(position, EARTH_ROTATION_RAD_S * seconds);
  return {
    latDeg: ground.latDeg,
    lngDeg: ground.lonDeg,
    altKm: elements.altitudeKm,
    xKm: position.x,
    yKm: position.y,
    zKm: position.z,
    radiusKm,
    raanDeg,
    argumentDeg,
  };
}

export function starmindTrail(request: OrbitRequest, seconds: number): TrailSample[] {
  const elements = circularElements(request, 0);
  const duration = elements.periodS * TRAIL_ORBIT_FRACTION;
  const samples: TrailSample[] = [];
  const count = TRAIL_SAMPLES;
  for (let index = 0; index < count; index += 1) {
    const time = seconds - duration + (duration * index) / (count - 1);
    const sample = starmindAt(request, time);
    samples.push({
      latDeg: sample.latDeg,
      lngDeg: sample.lngDeg,
      altKm: sample.altKm,
      exposure: exposureClass(sample.latDeg, sample.lngDeg, sample.altKm),
    });
  }
  return samples;
}

export function runPropagate(request: PropagateRequest, state: PropagateState): PropagateResult {
  if (request.records && request.records.length > 0) {
    const first = request.records[0];
    const key = `${request.records.length}:${String(first.NORAD_CAT_ID)}:${first.EPOCH}`;
    if (state.key !== key || !state.satrecs) {
      state.satrecs = request.records.map((record) => json2satrec(record));
      state.key = key;
    }
  }
  const satrecs = state.satrecs ?? [];
  const date = new Date(request.epochMs);
  const started = performance.now();
  const positions = new Float32Array(satrecs.length * 3);
  for (let index = 0; index < satrecs.length; index += 1) {
    const geo = propagateSatrec(satrecs[index], date);
    const offset = index * 3;
    if (!geo) {
      positions[offset] = Number.NaN;
      positions[offset + 1] = Number.NaN;
      positions[offset + 2] = Number.NaN;
      continue;
    }
    positions[offset] = geo.latDeg;
    positions[offset + 1] = geo.lngDeg;
    positions[offset + 2] = geo.altKm;
  }
  const seconds = (request.epochMs - request.originMs) / 1000;
  const starmind = starmindAt(request.orbit, seconds);
  const trail = starmindTrail(request.orbit, seconds);
  return {
    epochMs: request.epochMs,
    ms: performance.now() - started,
    positions,
    starmind,
    trail,
  };
}
