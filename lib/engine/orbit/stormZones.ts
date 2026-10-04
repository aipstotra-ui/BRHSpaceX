import { rad } from "@/lib/engine/orbit/angles";
import { EARTH_ROTATION_PHASES, EARTH_ROTATION_RAD_S, RE_M, SAMPLES_PER_ORBIT } from "@/lib/engine/orbit/constants";
import { circularPositionKm } from "@/lib/engine/orbit/eclipse";
import { circularElements, type OrbitRequest } from "@/lib/engine/orbit/elements";
import { raanAfterSeconds } from "@/lib/engine/orbit/j2";
import { groundPoint } from "@/lib/engine/orbit/saa";
import { dipoleL } from "@/lib/engine/radiation";

/**
 * Storm-dependent danger zones: the auroral oval and the solar-proton polar cap move equatorward as Kp rises.
 * Sources are in docs/research/orbit-model.md (storm zones).
 */

/**
 * estimate: centered-dipole north geomagnetic pole for epoch 2025 (IGRF-14), about 80.8° N, 72.6° W.
 * Taken from the NOAA NCEI pole list without a line-by-line check.
 */
export const DIPOLE_POLE_LAT_DEG = 80.8;
export const DIPOLE_POLE_LON_DEG = -72.6;
export const DIPOLE_POLE_SOURCE = "https://www.ngdc.noaa.gov/geomag/GeomagneticPoles.shtml";

/**
 * estimate: equatorward edge of the diffuse aurora, about 66° − 2° per Kp magnetic latitude, after the
 * Gussenhoven, Hardy & Heinemann (1983) linear fit. Coefficients are rounded and not checked against the paper.
 */
export const AURORA_EQ_A_DEG = 66;
export const AURORA_EQ_B_DEG = -2;
export const AURORA_SOURCE = "https://doi.org/10.1029/JA088iA07p05692";

/**
 * estimate: poleward edge, about 76° − 1° per Kp. Chosen so quiet Kp 2 gives roughly the 62°–74° band and
 * matches NOAA's average-oval description (about 67° to 75°). Not a fitted value.
 */
export const AURORA_POLE_A_DEG = 76;
export const AURORA_POLE_B_DEG = -1;

/**
 * estimate: solar-proton (about 10 MeV) cutoff, about 65° − 1° per Kp magnetic latitude, after the SAMPEX
 * cutoff studies (Leske et al. 2001). Coefficients are rounded and not checked against the paper.
 */
export const SEP_CUTOFF_A_DEG = 65;
export const SEP_CUTOFF_B_DEG = -1;
export const SEP_SOURCE = "https://doi.org/10.1029/2000JA000212";

/** NOAA S-scale thresholds on GOES >10 MeV integral flux: S1 10, S2 100, S3 1,000, S4 10,000, S5 100,000 pfu. */
export const S_SCALE_PFU = [10, 100, 1000, 10000, 100000] as const;
export const S_SCALE_SOURCE = "https://www.spaceweather.gov/noaa-scales-explanation";

/** Geomagnetic latitude of a geographic point in the centered-dipole frame. */
export function magneticLatitudeDeg(latDeg: number, lonDeg: number): number {
  const phi = rad(latDeg);
  const pole = rad(DIPOLE_POLE_LAT_DEG);
  const dLon = rad(lonDeg - DIPOLE_POLE_LON_DEG);
  const sine = Math.sin(phi) * Math.sin(pole) + Math.cos(phi) * Math.cos(pole) * Math.cos(dLon);
  return (Math.asin(Math.max(-1, Math.min(1, sine))) * 180) / Math.PI;
}

/** Dipole L at a geographic point, using geomagnetic latitude (replaces the M5 geographic stand-in). */
export function magneticDipoleL(radiusM: number, latDeg: number, lonDeg: number): number {
  return dipoleL(radiusM / RE_M, rad(magneticLatitudeDeg(latDeg, lonDeg)));
}

export function auroralBoundaryMlatDeg(kp: number): number {
  return AURORA_EQ_A_DEG + AURORA_EQ_B_DEG * kp;
}

export function auroralPolewardMlatDeg(kp: number): number {
  return AURORA_POLE_A_DEG + AURORA_POLE_B_DEG * kp;
}

export function sepCutoffMlatDeg(kp: number): number {
  return SEP_CUTOFF_A_DEG + SEP_CUTOFF_B_DEG * kp;
}

export function sscale(pfu: number): string {
  let level = 0;
  S_SCALE_PFU.forEach((threshold, index) => {
    if (pfu >= threshold) {
      level = index + 1;
    }
  });
  return `S${level}`;
}

/** A solar-proton event is under way at NOAA S1 or above. */
export function sepActive(pfu: number): boolean {
  return pfu >= S_SCALE_PFU[0];
}

export function inAuroralOval(latDeg: number, lonDeg: number, kp: number): boolean {
  const mlat = Math.abs(magneticLatitudeDeg(latDeg, lonDeg));
  return mlat >= auroralBoundaryMlatDeg(kp) && mlat <= auroralPolewardMlatDeg(kp);
}

export function inSepCap(latDeg: number, lonDeg: number, kp: number, protonPfu: number | null): boolean {
  if (protonPfu === null || !sepActive(protonPfu)) {
    return false;
  }
  return Math.abs(magneticLatitudeDeg(latDeg, lonDeg)) >= sepCutoffMlatDeg(kp);
}

/** Points along a constant-magnetic-latitude circle, as geographic coordinates. */
export function magneticCircle(mlatDeg: number, north: boolean, steps = 180): { latDeg: number; lonDeg: number }[] {
  const lam = rad(north ? mlatDeg : -mlatDeg);
  const theta = rad(90 - DIPOLE_POLE_LAT_DEG);
  const lonP = rad(DIPOLE_POLE_LON_DEG);
  const points: { latDeg: number; lonDeg: number }[] = [];
  for (let step = 0; step < steps; step += 1) {
    const mlon = (2 * Math.PI * step) / steps;
    const x = Math.cos(lam) * Math.cos(mlon);
    const y = Math.cos(lam) * Math.sin(mlon);
    const z = Math.sin(lam);
    // Rotate the dipole frame onto the geographic frame: about y by the pole colatitude, then about z by its longitude.
    const x1 = x * Math.cos(theta) + z * Math.sin(theta);
    const z1 = -x * Math.sin(theta) + z * Math.cos(theta);
    const x2 = x1 * Math.cos(lonP) - y * Math.sin(lonP);
    const y2 = x1 * Math.sin(lonP) + y * Math.cos(lonP);
    points.push({
      latDeg: (Math.asin(Math.max(-1, Math.min(1, z1))) * 180) / Math.PI,
      lonDeg: (Math.atan2(y2, x2) * 180) / Math.PI,
    });
  }
  return points;
}

export interface ZoneFractions {
  auroral: number;
  /** Share poleward of the solar-proton cutoff, whether or not an event is under way. */
  sepCap: number;
}

const cache = new Map<string, ZoneFractions>();

/** Orbit share inside the Kp-dependent zones, sampled like the M5 environment (rotation phases × samples). */
export function zoneFractions(request: OrbitRequest, kp: number): ZoneFractions {
  const key = [request.altitudeKm, request.inclinationDeg, request.raanDeg, request.sunSynchronous, request.ltanHours, kp.toFixed(2)].join("|");
  const hit = cache.get(key);
  if (hit) {
    return hit;
  }
  const elements = circularElements(request, 0);
  const radiusKm = elements.semiMajorM / 1000;
  const eq = auroralBoundaryMlatDeg(kp);
  const pole = auroralPolewardMlatDeg(kp);
  const cutoff = sepCutoffMlatDeg(kp);
  const phaseSeconds = 86400 / EARTH_ROTATION_PHASES;
  let auroral = 0;
  let sep = 0;
  let total = 0;
  for (let phase = 0; phase < EARTH_ROTATION_PHASES; phase += 1) {
    const t0 = phase * phaseSeconds;
    for (let sample = 0; sample < SAMPLES_PER_ORBIT; sample += 1) {
      const dt = (sample * elements.periodS) / SAMPLES_PER_ORBIT;
      const raan = raanAfterSeconds(elements.raanDeg, elements.altitudeKm, elements.inclinationDeg, t0 + dt);
      const position = circularPositionKm(radiusKm, elements.inclinationDeg, raan, (360 * sample) / SAMPLES_PER_ORBIT);
      const ground = groundPoint(position, EARTH_ROTATION_RAD_S * (t0 + dt));
      const mlat = Math.abs(magneticLatitudeDeg(ground.latDeg, ground.lonDeg));
      if (mlat >= eq && mlat <= pole) {
        auroral += 1;
      }
      if (mlat >= cutoff) {
        sep += 1;
      }
      total += 1;
    }
  }
  const result = { auroral: auroral / total, sepCap: sep / total };
  if (cache.size > 500) {
    cache.clear();
  }
  cache.set(key, result);
  return result;
}

/** Share of the orbit exposed to solar protons right now: zero unless an S1+ event is under way. */
export function sepCapFraction(orbit: { altitudeKm: number; inclinationDeg: number }, kp: number, protonPfu: number): number {
  if (!sepActive(protonPfu)) {
    return 0;
  }
  return zoneFractions(
    { altitudeKm: orbit.altitudeKm, inclinationDeg: orbit.inclinationDeg, sunSynchronous: false, ltanHours: null, raanDeg: 0 },
    kp,
  ).sepCap;
}
