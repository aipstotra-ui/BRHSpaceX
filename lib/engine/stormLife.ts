import { ACTIVITY_MID } from "@/lib/engine/orbit/constants";
import { densityKgM3 } from "@/lib/engine/orbit/density";
import type { OrbitRequest } from "@/lib/engine/orbit/elements";
import { sepActive, zoneFractions } from "@/lib/engine/orbit/stormZones";

/**
 * How fast a storm uses up chip life, relative to the conditions the multi-year lifetime assumes
 * (F10.7 150, Ap 15, trapped dose only).
 */

/** Kp (in thirds) to the 3-hour ap index, the standard GFZ/NOAA conversion table. */
const KP_TO_AP: [number, number][] = [
  [0, 0], [1 / 3, 2], [2 / 3, 3], [1, 4], [4 / 3, 5], [5 / 3, 6], [2, 7], [7 / 3, 9], [8 / 3, 12],
  [3, 15], [10 / 3, 18], [11 / 3, 22], [4, 27], [13 / 3, 32], [14 / 3, 39], [5, 48], [16 / 3, 56],
  [17 / 3, 67], [6, 80], [19 / 3, 94], [20 / 3, 111], [7, 132], [22 / 3, 154], [23 / 3, 179],
  [8, 207], [25 / 3, 236], [26 / 3, 300], [9, 400],
];
export const KP_TO_AP_SOURCE = "https://kp.gfz-potsdam.de/en/data";

/**
 * estimate: dose per unit solar-proton fluence, rad(Si) per proton/cm2. 1.602e-8 × an effective
 * stopping power of about 20 MeV cm2/g for a soft SEP spectrum behind thin shielding.
 */
export const SEP_RAD_PER_FLUENCE = 3e-7;

const SECONDS_PER_YEAR = 365.25 * 86400;
const MS_PER_DAY = 86_400_000;

export function kpToAp(kp: number): number {
  const clamped = Math.min(9, Math.max(0, kp));
  for (let i = 1; i < KP_TO_AP.length; i += 1) {
    const [k1, a1] = KP_TO_AP[i];
    if (clamped <= k1) {
      const [k0, a0] = KP_TO_AP[i - 1];
      return a0 + ((clamped - k0) / (k1 - k0)) * (a1 - a0);
    }
  }
  return 400;
}

/** Orbital decay rate at this Kp divided by the rate the drag lifetime assumes. */
export function dragAging(altitudeKm: number, kp: number): number {
  const reference = densityKgM3(altitudeKm, ACTIVITY_MID);
  if (!(reference > 0)) {
    return 1;
  }
  return densityKgM3(altitudeKm, { f107: ACTIVITY_MID.f107, ap: kpToAp(kp) }) / reference;
}

/** Solar-proton dose rate on this orbit, rad(Si)/yr. Zero unless an S1+ event is under way. */
export function sepDoseRadPerYear(request: OrbitRequest, kp: number, protonPfu: number | null): number {
  if (protonPfu === null || !sepActive(protonPfu)) {
    return 0;
  }
  const share = zoneFractions(request, kp).sepCap;
  // pfu is per steradian; 4π converts an isotropic flux to omnidirectional (estimate).
  return protonPfu * 4 * Math.PI * share * SEP_RAD_PER_FLUENCE * SECONDS_PER_YEAR;
}

/** Total dose rate at this moment divided by the trapped-only rate the TID lifetime assumes. */
export function doseAging(trappedKradPerYear: number, request: OrbitRequest, kp: number, protonPfu: number | null): number {
  const trapped = trappedKradPerYear * 1000;
  if (!(trapped > 0)) {
    return 1;
  }
  return 1 + sepDoseRadPerYear(request, kp, protonPfu) / trapped;
}

export interface Aging {
  drag: number;
  dose: number;
  /** Aging of the limit that sets the lifetime. */
  binding: number;
}

export function agingAt(
  binding: string,
  request: OrbitRequest,
  trappedKradPerYear: number,
  kp: number,
  protonPfu: number | null,
): Aging {
  const drag = dragAging(request.altitudeKm, kp);
  const dose = doseAging(trappedKradPerYear, request, kp, protonPfu);
  const limit = binding === "drag" ? drag : binding === "TID" ? dose : Math.max(drag, dose);
  return { drag, dose, binding: limit };
}

export interface StormPoint {
  timeMs: number;
  kp: number | null;
  protonPfu: number | null;
}

/**
 * Extra lifetime used, in days, from the first point to `upTo` inclusive. Each point holds until the next one.
 * Only aging above 1 counts, so quiet hours do not "refund" life.
 */
export function extraLifeUsedDays(
  points: StormPoint[],
  upTo: number,
  binding: string,
  request: OrbitRequest,
  trappedKradPerYear: number,
): number {
  let used = 0;
  for (let i = 0; i < Math.min(upTo, points.length - 1); i += 1) {
    const point = points[i];
    if (point.kp === null) {
      continue;
    }
    const days = (points[i + 1].timeMs - point.timeMs) / MS_PER_DAY;
    const aging = agingAt(binding, request, trappedKradPerYear, point.kp, point.protonPfu).binding;
    used += Math.max(0, aging - 1) * days;
  }
  return used;
}
