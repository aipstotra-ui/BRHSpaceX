import {
  EARTH_ROTATION_PHASES,
  EARTH_ROTATION_RAD_S,
  RE_M,
  SAMPLES_PER_ORBIT,
  SP8116_URL,
} from "@/lib/engine/orbit/constants";
import { DERIVED_SHELL } from "@/lib/engine/orbit/derivedShell";
import { circularElements, type OrbitRequest } from "@/lib/engine/orbit/elements";
import { circularPositionKm, ECLIPSE_SOURCE, shadowKind } from "@/lib/engine/orbit/eclipse";
import { raanAfterSeconds } from "@/lib/engine/orbit/j2";
import { annualDoseKrad } from "@/lib/engine/orbit/lifetime";
import { geographicDipoleL, inAuroralZone, inOuterBelt } from "@/lib/engine/orbit/lshell";
import { meanMinMax, rangeValue, type RangeValue } from "@/lib/engine/orbit/range";
import { groundPoint, inSaaGeographic } from "@/lib/engine/orbit/saa";
import { eclipticLongitudes, sunRightAscensionDeg, sunVectorKm } from "@/lib/engine/orbit/sun";
import { GBM_SAA_SOURCE } from "@/lib/engine/radiation";

export interface OrbitEnvironment {
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
  auroral: number[];
  outer: number[];
} {
  const elements = circularElements(request, 0);
  const radiusKm = elements.semiMajorM / 1000;
  const saa: number[] = [];
  const auroral: number[] = [];
  const outer: number[] = [];
  const phaseSeconds = 86400 / EARTH_ROTATION_PHASES;
  for (let phase = 0; phase < EARTH_ROTATION_PHASES; phase += 1) {
    const t0 = phase * phaseSeconds;
    let saaHits = 0;
    let auroralHits = 0;
    let outerHits = 0;
    for (let sample = 0; sample < SAMPLES_PER_ORBIT; sample += 1) {
      const dt = (sample * elements.periodS) / SAMPLES_PER_ORBIT;
      const raan = raanAfterSeconds(elements.raanDeg, elements.altitudeKm, elements.inclinationDeg, t0 + dt);
      const argument = (360 * sample) / SAMPLES_PER_ORBIT;
      const position = circularPositionKm(radiusKm, elements.inclinationDeg, raan, argument);
      const earth = EARTH_ROTATION_RAD_S * (t0 + dt);
      const ground = groundPoint(position, earth);
      if (inSaaGeographic(ground.latDeg, ground.lonDeg)) {
        saaHits += 1;
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
    auroral.push(auroralHits / denom);
    outer.push(outerHits / denom);
  }
  return { saa, auroral, outer };
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

export function demoReferenceSaa(): number {
  if (referenceSaa === null) {
    const samples = exposure({
      altitudeKm: DERIVED_SHELL.meanAltitudeKm,
      inclinationDeg: DERIVED_SHELL.meanInclinationDeg,
      sunSynchronous: false,
      ltanHours: null,
      raanDeg: 0,
    }).saa;
    referenceSaa = meanMinMax(samples).mid;
  }
  return referenceSaa;
}

export function orbitEnvironment(request: OrbitRequest): OrbitEnvironment {
  const started = performance.now();
  const exposed = exposure(request);
  const eclipse = eclipseSamples(request);
  const saa = fractionRange(exposed.saa, "1", [
    "Fraction of samples inside the Fermi GBM SAA polygon. The polygon is geographic and is not altitude-dependent.",
    "72 samples per orbit and 24 Earth-rotation phases are estimates. Earth rotation 7.2921150e-5 rad/s is an estimate.",
    "Low and high are the minimum and maximum across those phases. Mid is the mean.",
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
  const annualDose = annualDoseKrad(saa, demoReferenceSaa());
  return {
    saaFraction: saa,
    auroralFraction: auroral,
    outerBeltFraction: outer,
    eclipseFraction,
    annualDose,
    milliseconds: performance.now() - started,
  };
}
