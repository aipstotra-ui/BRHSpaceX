import { describe, expect, it } from "vitest";

import {
  bandContainsInstalled,
  peakExceedsRadiator,
  PEAK_FLAG_TEXT,
  radiatorAreaM2,
  radiatorTemperatureK,
} from "@/lib/engine/thermal";

const EPS = 0.9;
const SINK = 200;

function area(powerKw: number, temperatureK: number, sides: 1 | 2): number {
  return radiatorAreaM2(powerKw * 1000, temperatureK, SINK, EPS, sides);
}

describe("thermal golden", () => {
  it("matches the research table within 0.1 m2", () => {
    expect(Math.abs(area(175, 320, 2) - 193.0)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(area(175, 340, 2) - 145.8)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(area(120, 320, 2) - 132.3)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(area(120, 340, 2) - 99.9)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(area(250, 320, 2) - 275.7)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(area(250, 340, 2) - 208.2)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(area(175, 320, 1) - 385.9)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(area(175, 340, 1) - 291.5)).toBeLessThanOrEqual(0.1);
  });

  it("places the sheet radiators inside the 2-sided 320 K to 340 K band", () => {
    expect(bandContainsInstalled(160, 175, 2, SINK, EPS)).toBe(true);
    expect(bandContainsInstalled(110, 120, 2, SINK, EPS)).toBe(true);
    expect(bandContainsInstalled(160, 175, 1, SINK, EPS)).toBe(false);
  });

  it("flags a 250 kW peak on a 160 m2 radiator", () => {
    expect(peakExceedsRadiator(250, 160, 2, SINK, EPS)).toBe(true);
    expect(Math.min(area(250, 320, 2), area(250, 340, 2))).toBeGreaterThan(160);
    expect(PEAK_FLAG_TEXT).toBe("peak not steadily sheddable; must be buffered or short");
  });

  it("back-solves both AI1 pairs to 1.09 kW/m2 and 333 K", () => {
    expect(Math.abs(175 / 160 - 1.09)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(120 / 110 - 1.09)).toBeLessThanOrEqual(0.01);
    const temperature = radiatorTemperatureK(175000, 160, SINK, EPS, 2);
    expect(Math.abs(temperature - 333)).toBeLessThanOrEqual(1);
  });
});
