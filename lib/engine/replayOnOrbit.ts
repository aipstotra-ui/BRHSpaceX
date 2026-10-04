import may2024 from "@/data/replays/may2024.json";

import { type ActionName, actionCost, uncorrectable } from "@/lib/engine/costCheck";
import { DERIVED_SHELL } from "@/lib/engine/orbit/derivedShell";

export const DEFAULT_ORBIT_KM = DERIVED_SHELL.meanAltitudeKm;
export const SEP_ONSET = "2024-05-10T13:35:00Z";

export interface ReplayHour {
  time: string;
  kp: number | null;
  dst: number | null;
  gLevel: string | null;
  forecastKpP50: number | null;
}

export interface OrbitReplay {
  altitudeKm: number;
  cost: number;
  downtimeHours: number;
  uncorrectable: number;
  dose: number;
  actions: ActionName[];
}

export interface ReplayDelta {
  cost: number;
  downtimeHours: number;
  uncorrectable: number;
  dose: number;
}

function saaFraction(altitudeKm: number): number {
  return Math.min(0.4, Math.max(0.02, 0.35 - altitudeKm / 8000));
}

function score(hours: ReplayHour[], altitudeKm: number): OrbitReplay {
  const saa = saaFraction(altitudeKm);
  let cost = 0;
  let downtime = 0;
  let bad = 0;
  let dose = 0;
  const actions: ActionName[] = [];
  for (let index = 0; index < hours.length; index += 1) {
    const window = hours.slice(index, index + 8);
    const totals = new Map<ActionName, number>();
    for (const action of ["continue", "checkpoint", "throttle", "safe mode"] as const) {
      let total = 0;
      for (const hour of window) {
        total += actionCost(uncorrectable(hour.kp ?? 0, saa, 1), action);
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
    const kp = hours[index]?.kp ?? 0;
    const amount = uncorrectable(kp, saa, 1);
    cost += actionCost(amount, best);
    bad += amount;
    dose += amount * 0.01;
    if (best === "safe mode") {
      downtime += 6;
    } else if (best === "checkpoint") {
      downtime += 0.25;
    }
  }
  return { altitudeKm, cost, downtimeHours: downtime, uncorrectable: bad, dose, actions };
}

export function replayOnOrbit(chosenAltitudeKm: number, defaultAltitudeKm = DEFAULT_ORBIT_KM) {
  const hours = may2024.hours as ReplayHour[];
  const chosen = score(hours, chosenAltitudeKm);
  const baseline = score(hours, defaultAltitudeKm);
  const delta: ReplayDelta = {
    cost: chosen.cost - baseline.cost,
    downtimeHours: chosen.downtimeHours - baseline.downtimeHours,
    uncorrectable: chosen.uncorrectable - baseline.uncorrectable,
    dose: chosen.dose - baseline.dose,
  };
  const firstMove = hours.find((hour, index) => chosen.actions[index] !== "continue");
  return {
    label: may2024.label,
    markers: may2024.markers,
    hours,
    chosen,
    baseline,
    delta,
    firstNonContinue: firstMove?.time ?? null,
  };
}
