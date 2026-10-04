import { describe, expect, it } from "vitest";

import {
  doseGridAvailable,
  foldInclination,
  gridDoseRadPerYear,
  gridUpsetFlux,
} from "@/lib/engine/orbit/doseGrid";
import { orbitEnvironment } from "@/lib/engine/orbit/environment";

const orbit = (altitudeKm: number, inclinationDeg = 53) => ({
  altitudeKm,
  inclinationDeg,
  sunSynchronous: false,
  ltanHours: null,
  raanDeg: 0,
});

describe.runIf(doseGridAvailable())("R1 dose grid", () => {
  it("raises trapped dose and upset flux with altitude", () => {
    for (const phase of ["min", "max"] as const) {
      expect(gridDoseRadPerYear(phase, 1100, 53, 2.54)).toBeGreaterThan(gridDoseRadPerYear(phase, 500, 53, 2.54));
      expect(gridUpsetFlux(phase, 1100, 53)).toBeGreaterThan(gridUpsetFlux(phase, 500, 53));
    }
  });

  it("lowers dose behind more shielding", () => {
    expect(gridDoseRadPerYear("max", 800, 98, 10)).toBeLessThan(gridDoseRadPerYear("max", 800, 98, 1));
  });

  it("treats retrograde orbits like their prograde mirror", () => {
    expect(foldInclination(98)).toBe(82);
    expect(gridDoseRadPerYear("min", 700, 98, 2)).toBeCloseTo(gridDoseRadPerYear("min", 700, 82, 2), 10);
  });

  it("feeds the orbit environment instead of the SAA-scaled anchor", () => {
    const low = orbitEnvironment(orbit(500), 2.54).annualDose;
    const high = orbitEnvironment(orbit(1400), 2.54).annualDose;
    expect(high.mid).toBeGreaterThan(low.mid * 2);
    expect(low.low).toBeLessThanOrEqual(low.mid);
    expect(low.mid).toBeLessThanOrEqual(low.high);
  });
});
