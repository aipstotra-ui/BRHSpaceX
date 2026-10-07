import { type ActionName, actionCost, uncorrectable } from "@/lib/engine/costCheck";
import { DERIVED_SHELL } from "@/lib/engine/orbit/derivedShell";
import { doseGridAvailable, gridDoseRadPerYear, gridUpsetFlux, type SolarPhase } from "@/lib/engine/orbit/doseGrid";
import { demoReferenceSaa, orbitEnvironment } from "@/lib/engine/orbit/environment";
import { sepActive, sepCapFraction } from "@/lib/engine/orbit/stormZones";
import { omnidirectionalQuietFlux } from "@/lib/engine/radiation";
import { DEFAULT_EVENT_ID, eventById, type EventId } from "@/lib/events/registry";

export const DEFAULT_ORBIT_KM = DERIVED_SHELL.meanAltitudeKm;
export const DEFAULT_ORBIT_INC_DEG = DERIVED_SHELL.meanInclinationDeg;

/**
 * estimate: the replays sit in active phases of their solar cycles, so they read the AP8/AE8 solar-maximum grid.
 * The phase choice is a design choice.
 */
export const REPLAY_PHASE: SolarPhase = "max";

/**
 * estimate: shielding depth for replay dose, mm Al. The thinnest grid point, matching the 0 mm presets.
 */
export const REPLAY_DEPTH_MM_AL = 0.5;

const HOURS_PER_YEAR = 365.25 * 24;

export interface ReplayHour {
  time: string;
  kp: number | null;
  dst: number | null;
  gLevel: string | null;
  forecastKpP50: number | null;
  goesProtonFlux?: number | null;
}

export interface ReplayOrbit {
  altitudeKm: number;
  inclinationDeg: number;
}

export interface OrbitReplay {
  altitudeKm: number;
  inclinationDeg: number;
  cost: number;
  downtimeHours: number;
  uncorrectable: number;
  /** Trapped dose over the replay window, rad(Si). Solar-proton dose is not modeled. */
  dose: number;
  actions: ActionName[];
  /** Per-hour exposure relative to the default orbit's quiet trapped flux. */
  exposure: number[];
  /** Per-hour uncorrectable amount fed to the cost model, so other action plans can be scored the same way. */
  amounts: number[];
}

export interface ReplayDelta {
  cost: number;
  downtimeHours: number;
  uncorrectable: number;
  dose: number;
}

export const REPLAY_NOTES = [
  "Trapped exposure is the orbit-averaged AP8 flux above the upset threshold. The M8 cost model's max(0, Kp − 2) factor carries the storm scaling.",
  "Solar-proton exposure is the GOES >10 MeV flux, times 4π (isotropic, estimate), times the share of the orbit poleward of the Kp-dependent cutoff. Counting every >10 MeV proton as able to upset is an upper bound.",
  "Both are divided by the default orbit's quiet trapped flux, then fed into the M8 cost model with the default orbit's SAA fraction as the scale.",
  "estimate: hours with solar protons use at least Kp 3 in that factor, so a proton event counts even when the field is quiet.",
  "Dose is trapped dose from the R1 grid at solar maximum and 0.5 mm Al. Solar-proton dose is not modeled.",
];

function trappedFlux(orbit: ReplayOrbit): number {
  if (doseGridAvailable()) {
    return gridUpsetFlux(REPLAY_PHASE, orbit.altitudeKm, orbit.inclinationDeg);
  }
  const saa = orbitEnvironment({
    altitudeKm: orbit.altitudeKm,
    inclinationDeg: orbit.inclinationDeg,
    sunSynchronous: false,
    ltanHours: null,
    raanDeg: 0,
  }).saaFraction.mid;
  return saa * omnidirectionalQuietFlux().value;
}

function hourlyDoseRad(orbit: ReplayOrbit): number {
  if (!doseGridAvailable()) {
    return 0;
  }
  return gridDoseRadPerYear(REPLAY_PHASE, orbit.altitudeKm, orbit.inclinationDeg, REPLAY_DEPTH_MM_AL) / HOURS_PER_YEAR;
}

function exposureSeries(hours: ReplayHour[], orbit: ReplayOrbit, referenceFlux: number): number[] {
  const trapped = trappedFlux(orbit);
  return hours.map((hour) => {
    const kp = hour.kp ?? 0;
    const pfu = hour.goesProtonFlux ?? 0;
    const sep = pfu * 4 * Math.PI * sepCapFraction(orbit, kp, pfu);
    return referenceFlux > 0 ? (trapped + sep) / referenceFlux : 0;
  });
}

function score(hours: ReplayHour[], orbit: ReplayOrbit, referenceFlux: number, scale: number): OrbitReplay {
  const exposure = exposureSeries(hours, orbit, referenceFlux);
  const doseRate = hourlyDoseRad(orbit);
  // The M8 cost model takes max(0, Kp - 2) x SAA. Solar protons do not need a disturbed field, so they get Kp 3.
  const amountAt = (index: number) => {
    const kp = hours[index]?.kp ?? 0;
    const pfu = hours[index]?.goesProtonFlux ?? 0;
    return uncorrectable(sepActive(pfu) ? Math.max(kp, 3) : kp, scale * (exposure[index] ?? 0), 1);
  };
  let cost = 0;
  let downtime = 0;
  let bad = 0;
  let dose = 0;
  const actions: ActionName[] = [];
  const amounts: number[] = [];
  for (let index = 0; index < hours.length; index += 1) {
    const totals = new Map<ActionName, number>();
    for (const action of ["continue", "checkpoint", "throttle", "safe mode"] as const) {
      let total = 0;
      for (let ahead = index; ahead < Math.min(hours.length, index + 8); ahead += 1) {
        total += actionCost(amountAt(ahead), action);
      }
      totals.set(action, total);
    }
    let best: ActionName = "continue";
    let bestCost = Number.POSITIVE_INFINITY;
    for (const [name, total] of totals) {
      if (total < bestCost) {
        best = name;
        bestCost = total;
      }
    }
    actions.push(best);
    const amount = amountAt(index);
    amounts.push(amount);
    cost += actionCost(amount, best);
    bad += amount;
    dose += doseRate;
    if (best === "safe mode") {
      downtime += 6;
    } else if (best === "checkpoint") {
      downtime += 0.25;
    }
  }
  return {
    altitudeKm: orbit.altitudeKm,
    inclinationDeg: orbit.inclinationDeg,
    cost,
    downtimeHours: downtime,
    uncorrectable: bad,
    dose,
    actions,
    exposure,
    amounts,
  };
}

/**
 * The exposure weight the M8 cost model multiplies by max(0, Kp - 2): the default orbit's SAA fraction,
 * scaled by this orbit's trapped flux plus any solar-proton flux, relative to the default orbit.
 * The policy's "saa" input uses this so the classifier and the replay cost agree.
 */
export function exposureWeight(orbit: ReplayOrbit, kp: number, protonPfu: number | null): number {
  const reference = trappedFlux({ altitudeKm: DEFAULT_ORBIT_KM, inclinationDeg: DEFAULT_ORBIT_INC_DEG });
  if (!(reference > 0)) {
    return demoReferenceSaa();
  }
  const pfu = protonPfu ?? 0;
  const sep = pfu * 4 * Math.PI * sepCapFraction(orbit, kp, pfu);
  return (demoReferenceSaa() * (trappedFlux(orbit) + sep)) / reference;
}

/** Cost, downtime and uncorrectable total of any action plan on the same hourly amounts. */
export function scorePlan(amounts: number[], plan: ActionName[]): { cost: number; downtimeHours: number } {
  let cost = 0;
  let downtimeHours = 0;
  amounts.forEach((amount, index) => {
    const action = plan[index] ?? "continue";
    cost += actionCost(amount, action);
    downtimeHours += action === "safe mode" ? 6 : action === "checkpoint" ? 0.25 : 0;
  });
  return { cost, downtimeHours };
}

function asOrbit(value: number | ReplayOrbit, inclinationDeg: number): ReplayOrbit {
  return typeof value === "number" ? { altitudeKm: value, inclinationDeg } : value;
}

/**
 * Replays a storm event (May 2024 by default) on the chosen orbit and on the default orbit.
 * A bare altitude keeps the default orbit's inclination.
 */
export function replayOnOrbit(
  chosen: number | ReplayOrbit,
  fallback: number | ReplayOrbit = DEFAULT_ORBIT_KM,
  eventId: EventId = DEFAULT_EVENT_ID,
) {
  const event = eventById(eventId);
  const hours = event.replay.hours as ReplayHour[];
  const chosenOrbit = asOrbit(chosen, DEFAULT_ORBIT_INC_DEG);
  const defaultOrbit = asOrbit(fallback, DEFAULT_ORBIT_INC_DEG);
  const referenceFlux = trappedFlux({ altitudeKm: DEFAULT_ORBIT_KM, inclinationDeg: DEFAULT_ORBIT_INC_DEG });
  const scale = demoReferenceSaa();
  const chosenRun = score(hours, chosenOrbit, referenceFlux, scale);
  const baseline = score(hours, defaultOrbit, referenceFlux, scale);
  const delta: ReplayDelta = {
    cost: chosenRun.cost - baseline.cost,
    downtimeHours: chosenRun.downtimeHours - baseline.downtimeHours,
    uncorrectable: chosenRun.uncorrectable - baseline.uncorrectable,
    dose: chosenRun.dose - baseline.dose,
  };
  const firstMove = hours.find((hour, index) => chosenRun.actions[index] !== "continue");
  return {
    eventId,
    label: event.replay.label,
    markers: event.replay.markers,
    hours,
    chosen: chosenRun,
    baseline,
    delta,
    firstNonContinue: firstMove?.time ?? null,
    notes: REPLAY_NOTES,
  };
}
