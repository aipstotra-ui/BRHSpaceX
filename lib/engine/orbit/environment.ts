import {
  EARTH_ROTATION_PHASES,
  EARTH_ROTATION_RAD_S,
  RE_M,
  SAMPLES_PER_ORBIT,
  SP8116_URL,
} from "@/lib/engine/orbit/constants";
import { DERIVED_SHELL } from "@/lib/engine/orbit/derivedShell";
import { circularElements, type OrbitRequest } from "@/lib/engine/orbit/elements";
import { inSaaAp8, protonMapAltitudeKm, SAA_EDGE_FLUX } from "@/lib/engine/globe/protonMap";
import { circularPositionKm, ECLIPSE_SOURCE, shadowKind } from "@/lib/engine/orbit/eclipse";
import { raanAfterSeconds } from "@/lib/engine/orbit/j2";
import {
  doseGridAvailable,
  doseGridDepthRange,
  doseGridModel,
  gridDoseRadPerYear,
  gridUpsetFlux,
  gridUpsetThresholdMeV,
} from "@/lib/engine/orbit/doseGrid";
import { annualDoseKrad } from "@/lib/engine/orbit/lifetime";
import { geographicDipoleL, inAuroralZone, inOuterBelt } from "@/lib/engine/orbit/lshell";
import { meanMinMax, rangeValue, type RangeValue } from "@/lib/engine/orbit/range";
import { groundPoint, inSaaGeographic } from "@/lib/engine/orbit/saa";
import { eclipticLongitudes, sunRightAscensionDeg, sunVectorKm } from "@/lib/engine/orbit/sun";
import { GBM_SAA_SOURCE } from "@/lib/engine/radiation";

export interface OrbitEnvironment {
  /** Orbit-averaged trapped-proton flux above the upset threshold, 1/cm2/s. Null without the R1 grid. */
  upsetFlux: RangeValue | null;
  saaFraction: RangeValue;
  auroralFraction: RangeValue;
  outerBeltFraction: RangeValue;
  eclipseFraction: RangeValue;
  annualDose: RangeValue;
  milliseconds: number;
}

function fractionRange(
  samples: number[],
  unit: string,
  assumptions: string[],
  sourceUrl?: string,
): RangeValue {
  const stats = meanMinMax(samples);
  return rangeValue({
    ...stats,
    unit,
    label: "estimate",
    sourceUrl,
    assumptions,
  });
}

function exposure(request: OrbitRequest): {
  saa: number[];
  saaPolygon: number[];
  auroral: number[];
  outer: number[];
} {
  const elements = circularElements(request, 0);
  const radiusKm = elements.semiMajorM / 1000;
  const saa: number[] = [];
  const saaPolygon: number[] = [];
  const auroral: number[] = [];
  const outer: number[] = [];
  const phaseSeconds = 86400 / EARTH_ROTATION_PHASES;
  for (let phase = 0; phase < EARTH_ROTATION_PHASES; phase += 1) {
    const t0 = phase * phaseSeconds;
    let saaHits = 0;
    let polygonHits = 0;
    let auroralHits = 0;
    let outerHits = 0;
    for (let sample = 0; sample < SAMPLES_PER_ORBIT; sample += 1) {
      const dt = (sample * elements.periodS) / SAMPLES_PER_ORBIT;
      const raan = raanAfterSeconds(elements.raanDeg, elements.altitudeKm, elements.inclinationDeg, t0 + dt);
      const argument = (360 * sample) / SAMPLES_PER_ORBIT;
      const position = circularPositionKm(radiusKm, elements.inclinationDeg, raan, argument);
      const earth = EARTH_ROTATION_RAD_S * (t0 + dt);
      const ground = groundPoint(position, earth);
      if (inSaaAp8(ground.latDeg, ground.lonDeg, elements.altitudeKm)) {
        saaHits += 1;
      }
      if (inSaaGeographic(ground.latDeg, ground.lonDeg)) {
        polygonHits += 1;
      }
      if (inAuroralZone(ground.latDeg)) {
        auroralHits += 1;
      }
      const lValue = geographicDipoleL(elements.semiMajorM, ground.latDeg);
      if (inOuterBelt(lValue)) {
        outerHits += 1;
      }
    }
    const denom = SAMPLES_PER_ORBIT;
    saa.push(saaHits / denom);
    saaPolygon.push(polygonHits / denom);
    auroral.push(auroralHits / denom);
    outer.push(outerHits / denom);
  }
  return { saa, saaPolygon, auroral, outer };
}

function eclipseSamples(request: OrbitRequest): number[] {
  const radiusKm = (RE_M + request.altitudeKm * 1000) / 1000;
  const fractions: number[] = [];
  for (const longitude of eclipticLongitudes()) {
    const elements = circularElements(request, sunRightAscensionDeg(longitude));
    const sun = sunVectorKm(longitude);
    let umbra = 0;
    for (let sample = 0; sample < SAMPLES_PER_ORBIT; sample += 1) {
      const argument = (360 * sample) / SAMPLES_PER_ORBIT;
      const position = circularPositionKm(radiusKm, elements.inclinationDeg, elements.raanDeg, argument);
      if (shadowKind(position, sun) === "umbra") {
        umbra += 1;
      }
    }
    fractions.push(umbra / SAMPLES_PER_ORBIT);
  }
  return fractions;
}

let referenceSaa: number | null = null;

/**
 * The M8 cost model's exposure scale: the demo orbit's share of samples inside the Fermi GBM SAA polygon.
 * It stays on the polygon, not the AP8 contour, because the AI policy's "saa" input and the replay costs were
 * calibrated on it. The SAA fraction shown to users is the AP8 contour (orbitEnvironment).
 */
export function demoReferenceSaa(): number {
  if (referenceSaa === null) {
    const samples = exposure({
      altitudeKm: DERIVED_SHELL.meanAltitudeKm,
      inclinationDeg: DERIVED_SHELL.meanInclinationDeg,
      sunSynchronous: false,
      ltanHours: null,
      raanDeg: 0,
    }).saaPolygon;
    referenceSaa = meanMinMax(samples).mid;
  }
  return referenceSaa;
}

export const DOSE_GRID_SOURCE = "https://prbem.github.io/IRBEM/";

/** Trapped dose from the R1 AP8/AE8 + SHIELDOSE-2 grid. Low and high are the two solar phases. */
function gridAnnualDose(request: OrbitRequest, shieldingMmAl: number): RangeValue {
  const range = doseGridDepthRange();
  const depth = range ? Math.min(range.max, Math.max(range.min, shieldingMmAl)) : shieldingMmAl;
  const atMin = gridDoseRadPerYear("min", request.altitudeKm, request.inclinationDeg, depth) / 1000;
  const atMax = gridDoseRadPerYear("max", request.altitudeKm, request.inclinationDeg, depth) / 1000;
  const low = Math.min(atMin, atMax);
  const high = Math.max(atMin, atMax);
  const clamped =
    range && (shieldingMmAl < range.min || shieldingMmAl > range.max)
      ? [`Shielding ${shieldingMmAl} mm Al is outside the grid, so dose is read at ${depth} mm Al.`]
      : [];
  return rangeValue({
    low,
    mid: (low + high) / 2,
    high,
    unit: "krad(Si)/yr",
    label: "estimate",
    sourceUrl: DOSE_GRID_SOURCE,
    assumptions: [
      `${doseGridModel()}. Behind ${depth} mm Al, orbit-averaged. Low and high are the solar-minimum and solar-maximum models. Mid is their mean.`,
      ...clamped,
      "Trapped protons and electrons only. Solar energetic protons and galactic cosmic rays are not in the grid.",
      "AP8/AE8 are static models of the 1960s–70s. The SAA has drifted since.",
    ],
  });
}

function gridFlux(request: OrbitRequest): RangeValue {
  const atMin = gridUpsetFlux("min", request.altitudeKm, request.inclinationDeg);
  const atMax = gridUpsetFlux("max", request.altitudeKm, request.inclinationDeg);
  const low = Math.min(atMin, atMax);
  const high = Math.max(atMin, atMax);
  return rangeValue({
    low,
    mid: (low + high) / 2,
    high,
    unit: "1/cm2/s",
    label: "estimate",
    sourceUrl: DOSE_GRID_SOURCE,
    assumptions: [
      `Orbit-averaged AP8 omnidirectional proton flux above ${gridUpsetThresholdMeV()} MeV, the threshold of the Zou et al. 2015 quiet SAA example.`,
      "Low and high are the solar-minimum and solar-maximum models. Mid is their mean.",
    ],
  });
}

export function orbitEnvironment(request: OrbitRequest, shieldingMmAl = 0): OrbitEnvironment {
  const started = performance.now();
  const exposed = exposure(request);
  const eclipse = eclipseSamples(request);
  const mapAltitudeKm = protonMapAltitudeKm(request.altitudeKm);
  const sampling = [
    "72 samples per orbit and 24 Earth-rotation phases are estimates. Earth rotation 7.2921150e-5 rad/s is an estimate.",
    "Low and high are the minimum and maximum across those phases. Mid is the mean.",
  ];
  const saa = fractionRange(exposed.saa, "1", [
    `Fraction of samples where the AP8MIN trapped-proton flux above 10 MeV is at least ${SAA_EDGE_FLUX} /cm²/s at this altitude, the SAA edge the globe draws (IRBEM, IGRF 2025 field).`,
    ...(mapAltitudeKm !== request.altitudeKm
      ? [`${request.altitudeKm.toFixed(0)} km is outside the map, so the SAA is read at ${mapAltitudeKm} km.`]
      : []),
    "The edge is a display choice. AP8's SAA edge is steep: moving it to 1 or 100 /cm²/s changed this fraction by under 3 percentage points for the 400–700 km orbits checked.",
    "AP8 is a 1960s–70s model paired with a modern field; flux magnitudes are approximate.",
    ...sampling,
  ], DOSE_GRID_SOURCE);
  const saaPolygon = fractionRange(exposed.saaPolygon, "1", [
    "Fraction of samples inside the Fermi GBM SAA polygon. The polygon is geographic and is not altitude-dependent.",
    ...sampling,
  ], GBM_SAA_SOURCE);
  const auroral = fractionRange(exposed.auroral, "1", [
    "Auroral zone is geographic latitude from 60° to 80°, the SP-8116 sentence. The sentence does not say geomagnetic, so geographic latitude is an estimate.",
    "NOAA's oval, about 75° at noon to 67° at midnight magnetic latitude, is a separate description and is not this fraction.",
  ], SP8116_URL);
  const outer = fractionRange(exposed.outer, "1", [
    "Outer belt is dipole L from 3 to 8 Earth radii, SP-8116.",
    "L uses M4's dipole formula with geographic latitude standing in for magnetic latitude. That stand-in is an estimate. It is not UNILIB L_m.",
  ], SP8116_URL);
  const eclipseFraction = fractionRange(eclipse, "1", [
    "Umbra fraction from Vallado algorithm 34. Penumbra is not counted as eclipse.",
    "Twelve ecliptic longitudes give the annual mean (mid) and the seasonal min and max.",
    "Sun direction uses the sourced 0.9856 deg/day rate only as the SSO target. Obliquity 23.439° is an estimate. Meeus coefficients are not invented.",
    "SSO RAAN is the sun right ascension plus (LTAN − 12) × 15°. Non-SSO RAAN stays at the requested value.",
  ], ECLIPSE_SOURCE);
  const grid = doseGridAvailable();
  const annualDose = grid ? gridAnnualDose(request, shieldingMmAl) : annualDoseKrad(saaPolygon, demoReferenceSaa());
  return {
    upsetFlux: grid ? gridFlux(request) : null,
    saaFraction: saa,
    auroralFraction: auroral,
    outerBeltFraction: outer,
    eclipseFraction,
    annualDose,
    milliseconds: performance.now() - started,
  };
}
