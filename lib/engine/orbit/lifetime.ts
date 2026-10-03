import {
  ACTIVITY_HIGH_DENSITY,
  ACTIVITY_LOW_DENSITY,
  ACTIVITY_MID,
  ANCHOR_ANNUAL_KRAD,
  DOSE_ANCHOR_URL,
  DRAG_STEP_KM,
  LIFETIME_CAP_YEARS,
  MU_M3_S2,
  RE_M,
} from "@/lib/engine/orbit/constants";
import { densityKgM3, type Activity } from "@/lib/engine/orbit/density";
import { rangeValue, type RangeValue } from "@/lib/engine/orbit/range";

export interface Vehicle {
  massKg: number;
  dragAreaM2: number;
  cd: number;
  eolAltitudeKm: number;
}

const DOSE_NOTE = [
  "750 rad(Si) over five years is the sourced anchor. Dividing by five gives 0.15 krad(Si)/yr.",
  "No SPENVIS dose grid was available. Annual dose scales that anchor by this orbit's SAA fraction over the demo orbit's SAA fraction.",
  "The orbit behind the 750 rad(Si) sentence is UNVERIFIED. The demo orbit is only the unit for the ratio. It is not an AI1 altitude and it is not the Google orbit.",
  "Shielding depth is displayed and is not applied. No shielding-thickness curve is used.",
];

export function annualDoseKrad(saa: { low: number; mid: number; high: number }, referenceSaa: number): RangeValue {
  const scale = (fraction: number) => {
    if (!(referenceSaa > 0)) {
      return ANCHOR_ANNUAL_KRAD;
    }
    return ANCHOR_ANNUAL_KRAD * (fraction / referenceSaa);
  };
  const low = scale(saa.low);
  const mid = scale(saa.mid);
  const high = scale(saa.high);
  return rangeValue({
    low: Math.min(low, mid, high),
    mid,
    high: Math.max(low, mid, high),
    unit: "krad(Si)/yr",
    label: "estimate",
    sourceUrl: DOSE_ANCHOR_URL,
    assumptions: DOSE_NOTE,
  });
}

export function timeToTidYears(tidLimitKrad: number, annual: RangeValue): RangeValue {
  const years = (dose: number) => (dose > 0 ? tidLimitKrad / dose : LIFETIME_CAP_YEARS);
  return rangeValue({
    low: years(annual.high),
    mid: years(annual.mid),
    high: years(annual.low),
    unit: "yr",
    label: "estimate",
    sourceUrl: DOSE_ANCHOR_URL,
    assumptions: [
      "Time to TID is the TID limit divided by the annual dose.",
      ...annual.assumptions,
    ],
  });
}

function decaySeconds(altitudeKm: number, vehicle: Vehicle, activity: Activity, densityScale: number): number {
  if (!(vehicle.massKg > 0) || !(vehicle.dragAreaM2 > 0) || !(vehicle.cd > 0)) {
    return LIFETIME_CAP_YEARS * 365.25 * 86400;
  }
  if (altitudeKm <= vehicle.eolAltitudeKm) {
    return 0;
  }
  const beta = (vehicle.cd * vehicle.dragAreaM2) / vehicle.massKg;
  let altitude = altitudeKm;
  let seconds = 0;
  while (altitude > vehicle.eolAltitudeKm + 1e-9) {
    const next = Math.max(vehicle.eolAltitudeKm, altitude - DRAG_STEP_KM);
    const midKm = (altitude + next) / 2;
    const rho = densityKgM3(midKm, activity) * densityScale;
    const semiMajor = RE_M + midKm * 1000;
    const rate = rho * beta * Math.sqrt(MU_M3_S2 * semiMajor);
    const dropM = (altitude - next) * 1000;
    seconds += rate > 0 ? dropM / rate : (LIFETIME_CAP_YEARS * 365.25 * 86400) / 10;
    altitude = next;
  }
  return seconds;
}

function years(seconds: number): number {
  return Math.min(LIFETIME_CAP_YEARS, seconds / (365.25 * 86400));
}

/** Drag-decay time down to the end-of-life altitude. High density is the short lifetime. */
export function dragDecayYears(altitudeKm: number, vehicle: Vehicle, densityScale = 1): RangeValue {
  const low = years(decaySeconds(altitudeKm, vehicle, ACTIVITY_HIGH_DENSITY, densityScale));
  const mid = years(decaySeconds(altitudeKm, vehicle, ACTIVITY_MID, densityScale));
  const high = years(decaySeconds(altitudeKm, vehicle, ACTIVITY_LOW_DENSITY, densityScale));
  return rangeValue({
    low: Math.min(low, mid, high),
    mid,
    high: Math.max(low, mid, high),
    unit: "yr",
    label: "estimate",
    assumptions: [
      "da/dt = −ρ (Cd A / m) sqrt(μ a), integrated downward in 1 km steps. The step is an estimate.",
      "Low lifetime uses F10.7 = 250 and Ap = 80. Mid uses F10.7 = 150 and Ap = 15. High lifetime uses F10.7 = 70 and Ap = 4.",
      "Mass, drag area, Cd, and end-of-life altitude are vehicle estimates. They are not Starlink values and not the solar-array area.",
      densityScale === 1
        ? "Quiet drag uses the density table with no storm multiplier."
        : "Storm drag multiplies density by the Kp upset multiplier. That application is an estimate.",
    ],
  });
}

export function estimatedLifetime(tid: RangeValue, drag: RangeValue): { years: RangeValue; binding: string } {
  let binding = "TID and drag";
  let chosen = tid;
  if (tid.mid < drag.mid) {
    binding = "TID";
    chosen = tid;
  } else if (drag.mid < tid.mid) {
    binding = "drag";
    chosen = drag;
  }
  return {
    binding,
    years: rangeValue({
      ...chosen,
      label: "estimate",
      assumptions: [
        `Estimated lifetime is the minimum of the TID and drag mid values. Binding limit: ${binding}.`,
        ...chosen.assumptions,
      ],
    }),
  };
}
