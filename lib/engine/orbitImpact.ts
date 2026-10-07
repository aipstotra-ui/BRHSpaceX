import type { ChipSpec, PayloadConfig } from "@/lib/types";

import { resolveTid, type UpsetKind } from "@/lib/engine/chipModel";
import { simulateImpact, type DeviceSeu } from "@/lib/engine/impact";
import { NOAA_SCALES_URL } from "@/lib/engine/orbit/constants";
import { orbitEnvironment } from "@/lib/engine/orbit/environment";
import { dragDecayYears, estimatedLifetime, timeToTidYears, type Vehicle } from "@/lib/engine/orbit/lifetime";
import type { RangeValue } from "@/lib/engine/orbit/range";
import { rangeValue } from "@/lib/engine/orbit/range";
import { estimatedStormMultiplier } from "@/lib/engine/upsets";
import { omnidirectionalQuietFlux } from "@/lib/engine/radiation";
import { zoneFractions } from "@/lib/engine/orbit/stormZones";
import { dragAging, kpToAp } from "@/lib/engine/stormLife";
import { radiatorTemperatureK } from "@/lib/engine/thermal";

export interface OrbitImpactInput {
  altitudeKm: number;
  inclinationDeg: number;
  sunSynchronous: boolean;
  ltanHours: number | null;
  raanDeg: number;
  vehicle: Vehicle;
  spec: ChipSpec;
  payload: PayloadConfig;
  memoryUnit?: "GB" | "KB";
  nodeKnown?: boolean;
  deviceSeu?: DeviceSeu;
}

export interface StormDelta {
  level: string;
  kp: number;
  /** Share of the orbit inside the Kp-dependent auroral oval. */
  auroralShare: number;
  /** Share of the orbit poleward of the solar-proton cutoff, used only during an S1+ proton event. */
  sepShare: number;
  deltaUpsetPerS: RangeValue;
  /** Days of drag life one day at this storm level uses beyond a quiet day (NRLMSIS density at the storm's Ap). */
  dragDaysPerStormDay: RangeValue;
}

export interface OrbitImpactResult {
  /** What upsetRate counts: raw bit flips, or (DRAM) ECC-uncorrectable errors. */
  upsetKind: UpsetKind;
  environmentMs: number;
  saaFraction: RangeValue;
  auroralFraction: RangeValue;
  outerBeltFraction: RangeValue;
  eclipseFraction: RangeValue;
  annualDose: RangeValue;
  upsetRate: RangeValue;
  tidYears: RangeValue;
  dragYears: RangeValue;
  lifetimeYears: RangeValue;
  binding: string;
  thermalMarginC: RangeValue;
  /** False when average power, radiator area, or the temperature limit is not given, so there is no margin. */
  thermalKnown: boolean;
  shieldingMmAl: RangeValue;
  storms: StormDelta[];
  /** Upsets per second per unit omnidirectional flux (1/cm2/s), so callers can add solar-proton flux. */
  upsetPerUnitFlux: number;
  /** Quiet-time (Kp 2) zone shares, for comparison with the storm rows. */
  quietAuroralShare: number;
  quietSepShare: number;
}

const G_LEVELS = [
  { level: "G1", kp: 5 },
  { level: "G2", kp: 6 },
  { level: "G3", kp: 7 },
  { level: "G4", kp: 8 },
  { level: "G5", kp: 9 },
] as const;

function scaleRange(fraction: RangeValue, factor: number, unit: string, assumptions: string[]): RangeValue {
  return rangeValue({
    low: fraction.low * factor,
    mid: fraction.mid * factor,
    high: fraction.high * factor,
    unit,
    label: "estimate",
    assumptions,
  });
}

export function orbitImpact(input: OrbitImpactInput): OrbitImpactResult {
  const request = {
    altitudeKm: input.altitudeKm,
    inclinationDeg: input.inclinationDeg,
    sunSynchronous: input.sunSynchronous,
    ltanHours: input.ltanHours,
    raanDeg: input.raanDeg,
  };
  const environment = orbitEnvironment(request, input.spec.shieldingMmAl);
  const quiet = simulateImpact({
    spec: input.spec,
    payload: input.payload,
    kp: 2,
    memoryUnit: input.memoryUnit,
    nodeKnown: input.nodeKnown,
    deviceSeu: input.deviceSeu,
  });
  const inSaaFlux = omnidirectionalQuietFlux().value;
  const upsetPerUnitFlux = inSaaFlux > 0 ? quiet.upsetRate.value / inSaaFlux : 0;
  const upsetRate = environment.upsetFlux
    ? scaleRange(environment.upsetFlux, upsetPerUnitFlux, "1/s", [
        quiet.upsetKind === "uncorrectable"
          ? "Orbit uncorrectable-error rate is the per-bit uncorrectable cross-section and bit count times the orbit-averaged AP8 flux above the upset threshold (R1 grid)."
          : "Orbit upset rate is the M4 cross-section and bit count times the orbit-averaged AP8 flux above the upset threshold (R1 grid).",
        ...environment.upsetFlux.assumptions,
        ...quiet.upsetRate.assumptions,
      ])
    : scaleRange(environment.saaFraction, quiet.upsetRate.value, "1/s", [
        "Orbit upset rate is the M4 quiet rate multiplied by the SAA time fraction.",
        "The M4 flux is an in-SAA example, so it is applied only during that fraction.",
        ...quiet.upsetRate.assumptions,
      ]);
  const tidLimit = resolveTid(input.spec);
  const tidYears = timeToTidYears(tidLimit.value, environment.annualDose);
  const dragYears = dragDecayYears(input.altitudeKm, input.vehicle);
  const life = estimatedLifetime(tidYears, dragYears);
  const radiatorK = radiatorTemperatureK(
    input.spec.avgPowerKw * 1000,
    input.payload.radiatorAreaM2,
    input.payload.tSinkK,
    input.payload.emissivity,
    input.payload.radiatorSides,
  );
  const thermalKnown = input.spec.avgPowerKw > 0 && input.payload.radiatorAreaM2 > 0 && input.spec.opTempMaxC > 0;
  const margin = thermalKnown ? input.spec.opTempMaxC - (radiatorK - 273.15) : 0;
  const thermalMarginC = rangeValue({
    low: margin,
    mid: margin,
    high: margin,
    unit: "°C",
    label: thermalKnown ? "estimate" : "UNVERIFIED",
    assumptions: thermalKnown
      ? [
          "Margin is the spec's maximum temperature minus the isothermal radiator temperature (M4). For the AI1 sheets the limit is the NVL72 45 °C liquid inlet, not a die limit.",
          "A pumped loop runs its radiator between the inlet and outlet temperatures, so against an inlet limit this margin is conservative by about half the loop's temperature rise, which is not published.",
          "The M4 radiator formula ignores sunlight, so the eclipse fraction does not change this temperature.",
        ]
      : ["Average power, radiator area, or the maximum temperature is not given, so no thermal margin is computed. 0 is not a measurement."],
  });
  const quietZones = zoneFractions(request, 2);
  const storms: StormDelta[] = G_LEVELS.map((level) => {
    const multiplier = estimatedStormMultiplier(level.kp).value;
    const delta = upsetRate.mid * (multiplier - 1);
    const dragDays = Math.max(0, dragAging(input.altitudeKm, level.kp) - 1);
    const zones = zoneFractions(request, level.kp);
    return {
      level: level.level,
      kp: level.kp,
      auroralShare: zones.auroral,
      sepShare: zones.sepCap,
      deltaUpsetPerS: rangeValue({
        low: delta,
        mid: delta,
        high: delta,
        unit: "1/s",
        label: "estimate",
        sourceUrl: NOAA_SCALES_URL,
        assumptions: [
          `${level.level} uses Kp ${level.kp}. Source: NOAA scales. The Kp multiplier is the M4 estimate 1 + 0.05 * max(0, Kp−2).`,
          "Delta upset is the orbit rate at that Kp minus the Kp 2 rate. The multiplier stands for wider solar-proton and cosmic-ray access in storms; trapped inner-belt protons do not rise (Zou et al. 2015 saw the SAA >70 MeV flux fall about 16%).",
        ],
      }),
      dragDaysPerStormDay: rangeValue({
        low: dragDays,
        mid: dragDays,
        high: dragDays,
        unit: "days",
        label: "estimate",
        sourceUrl: NOAA_SCALES_URL,
        assumptions: [
          `NRLMSIS 2.0 density at Ap ${Math.round(kpToAp(level.kp))} (Kp ${level.kp}) over density at Ap 15, both at F10.7 150, minus 1: the extra drag-life days one storm day uses.`,
          "Density at the equator point of the density table; real storm heating is uneven and lags Kp by hours.",
        ],
      }),
    };
  });
  return {
    upsetKind: quiet.upsetKind,
    environmentMs: environment.milliseconds,
    saaFraction: environment.saaFraction,
    auroralFraction: environment.auroralFraction,
    outerBeltFraction: environment.outerBeltFraction,
    eclipseFraction: environment.eclipseFraction,
    annualDose: environment.annualDose,
    upsetRate,
    tidYears,
    dragYears,
    lifetimeYears: life.years,
    binding: life.binding,
    thermalMarginC,
    thermalKnown,
    shieldingMmAl: rangeValue({
      low: input.spec.shieldingMmAl,
      mid: input.spec.shieldingMmAl,
      high: input.spec.shieldingMmAl,
      unit: "mm Al",
      label: "estimate",
      assumptions: environment.upsetFlux
        ? ["Shielding depth is applied to the dose through the R1 grid's depth axis."]
        : ["Shielding depth is shown and is not applied to the dose. No thickness curve is used."],
    }),
    storms,
    upsetPerUnitFlux,
    quietAuroralShare: quietZones.auroral,
    quietSepShare: quietZones.sepCap,
  };
}
