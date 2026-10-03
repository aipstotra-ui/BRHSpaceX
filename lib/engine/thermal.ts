import type { PayloadConfig } from "@/lib/types";
import type { SourceLabel } from "@/lib/types";

import { marked, type Marked } from "@/lib/engine/marked";

/** CODATA value stated in docs/research/engine-constants.md. */
export const STEFAN_BOLTZMANN = 5.670374e-8;

export const THERMAL_LOWER_BOUND =
  "Radiator area is a lower bound. Compute power is not total bus heat. Absorbed sunlight, albedo, Earth IR, and fin efficiency are ignored.";

export const PEAK_FLAG_TEXT = "peak not steadily sheddable; must be buffered or short";

export function radiatorAreaM2(
  powerW: number,
  temperatureK: number,
  tSinkK: number,
  emissivity: number,
  sides: 1 | 2,
): number {
  const net = temperatureK ** 4 - tSinkK ** 4;
  const denom = sides * emissivity * STEFAN_BOLTZMANN * net;
  if (!(denom > 0) || !Number.isFinite(powerW)) {
    return 0;
  }
  return powerW / denom;
}

export function radiatorTemperatureK(
  powerW: number,
  areaM2: number,
  tSinkK: number,
  emissivity: number,
  sides: 1 | 2,
): number {
  if (!(areaM2 > 0) || !(emissivity > 0) || !(sides > 0) || !Number.isFinite(powerW)) {
    return tSinkK;
  }
  const fourth = powerW / (areaM2 * sides * emissivity * STEFAN_BOLTZMANN) + tSinkK ** 4;
  if (!(fourth > 0)) {
    return tSinkK;
  }
  return fourth ** 0.25;
}

export function bandContainsInstalled(
  installedM2: number,
  powerKw: number,
  sides: 1 | 2,
  tSinkK: number,
  emissivity: number,
): boolean {
  const at320 = radiatorAreaM2(powerKw * 1000, 320, tSinkK, emissivity, sides);
  const at340 = radiatorAreaM2(powerKw * 1000, 340, tSinkK, emissivity, sides);
  const low = Math.min(at320, at340);
  const high = Math.max(at320, at340);
  return installedM2 >= low && installedM2 <= high;
}

export function peakExceedsRadiator(
  peakKw: number,
  installedM2: number,
  sides: 1 | 2,
  tSinkK: number,
  emissivity: number,
): boolean {
  const at320 = radiatorAreaM2(peakKw * 1000, 320, tSinkK, emissivity, sides);
  const at340 = radiatorAreaM2(peakKw * 1000, 340, tSinkK, emissivity, sides);
  return Math.min(at320, at340) > installedM2;
}

export interface ThermalReport {
  areaAvg320: Marked;
  areaAvg340: Marked;
  areaPeak320: Marked;
  areaPeak340: Marked;
  radiatorTemperatureK: Marked;
  kwPerM2: Marked;
  peakFlag: boolean;
  assumptions: string[];
}

function areaMarked(value: number): Marked {
  return marked({
    value,
    sigma: 0,
    unit: "m2",
    isEstimate: true,
    label: "estimate",
    assumptions: [
      "Area uses ε = 0.9 and Tsink = 200 K unless the payload overrides them. Both defaults are estimates. σ = 5.670374e-8.",
      THERMAL_LOWER_BOUND,
    ],
  });
}

export function assessThermal(
  avgPowerKw: number,
  peakPowerKw: number,
  payload: PayloadConfig,
  ratioLabel: SourceLabel,
): ThermalReport {
  const { radiatorSides, tSinkK, emissivity, radiatorAreaM2: area } = payload;
  const areaAvg320 = radiatorAreaM2(avgPowerKw * 1000, 320, tSinkK, emissivity, radiatorSides);
  const areaAvg340 = radiatorAreaM2(avgPowerKw * 1000, 340, tSinkK, emissivity, radiatorSides);
  const areaPeak320 = radiatorAreaM2(peakPowerKw * 1000, 320, tSinkK, emissivity, radiatorSides);
  const areaPeak340 = radiatorAreaM2(peakPowerKw * 1000, 340, tSinkK, emissivity, radiatorSides);
  const temperature = radiatorTemperatureK(avgPowerKw * 1000, area, tSinkK, emissivity, radiatorSides);
  const ratio = area > 0 ? avgPowerKw / area : 0;
  const temperatureKnown = area > 0 && emissivity > 0;
  return {
    areaAvg320: areaMarked(areaAvg320),
    areaAvg340: areaMarked(areaAvg340),
    areaPeak320: areaMarked(areaPeak320),
    areaPeak340: areaMarked(areaPeak340),
    radiatorTemperatureK: marked({
      value: temperature,
      sigma: 0,
      unit: "K",
      isEstimate: true,
      label: temperatureKnown ? "estimate" : "UNVERIFIED",
      assumptions: temperatureKnown
        ? ["Back-solved from average power, radiator area, side count, ε, and Tsink. ε and Tsink are estimates unless the user replaced them."]
        : ["Radiator area or emissivity is not a positive measurement, so temperature is not back-solved."],
    }),
    kwPerM2: marked({
      value: ratio,
      sigma: 0,
      unit: "kW/m2",
      isEstimate: ratioLabel !== "source",
      label: ratioLabel,
      assumptions: ["Kilowatts per square metre is average power divided by radiator area."],
    }),
    peakFlag: peakExceedsRadiator(peakPowerKw, area, radiatorSides, tSinkK, emissivity),
    assumptions: [THERMAL_LOWER_BOUND],
  };
}
