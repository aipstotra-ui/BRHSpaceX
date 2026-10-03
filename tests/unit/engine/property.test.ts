import { describe, expect, it } from "vitest";

import { simulateImpact, type ImpactResult } from "@/lib/engine/impact";
import { chipSpecSchema } from "@/lib/schemas/chipSpec";
import type { ChipSpec, PayloadConfig } from "@/lib/types";

const PAYLOAD: PayloadConfig = {
  radiatorAreaM2: 160,
  radiatorSides: 2,
  tSinkK: 200,
  emissivity: 0.9,
};

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomSpec(rng: () => number, index: number): ChipSpec {
  const spec: ChipSpec = {
    vendor: "Vendor",
    name: `Chip ${index}`,
    nodeNm: rng() * 40 - 5,
    acceleratorCount: Math.floor(rng() * 8),
    cpuCount: Math.floor(rng() * 4),
    memoryType: "DRAM",
    memoryCapacity: rng() * 128,
    eccScheme: rng() > 0.5 ? "SECDED" : "UNVERIFIED",
    avgPowerKw: rng() * 200 - 10,
    peakPowerKw: rng() * 300,
    opTempMinC: -40 + rng() * 20,
    opTempMaxC: 40 + rng() * 40,
    shieldingMmAl: rng() * 8,
  };
  if (index % 2 !== 0) {
    spec.seuCrossSection = rng() * 1e-12;
  }
  if (index % 3 !== 0) {
    spec.tidLimitKradSi = 1 + rng() * 100;
  }
  if (index % 5 !== 0) {
    spec.latchupLet = rng() * 80;
  }
  if (index % 7 !== 0) {
    spec.dieArea = rng() * 10;
  }
  return spec;
}

function numbersOf(impact: ImpactResult): number[] {
  const marked = [
    impact.directionalFlux,
    impact.omnidirectionalFlux,
    impact.storm,
    impact.bits,
    impact.crossSection,
    impact.upsetRate,
    impact.correctable,
    impact.due,
    impact.sdc,
    impact.fiveYearDose,
    impact.annualDose,
    impact.tidLimit,
    impact.lifetimeYears,
    impact.latchupLet,
    impact.dieAreaCm2,
    impact.drag,
    impact.thermal.areaAvg320,
    impact.thermal.areaAvg340,
    impact.thermal.areaPeak320,
    impact.thermal.areaPeak340,
    impact.thermal.radiatorTemperatureK,
    impact.thermal.kwPerM2,
  ];
  return [
    ...marked.flatMap((item) => [item.value, item.sigma]),
    impact.monteCarlo.upsetLow,
    impact.monteCarlo.upsetHigh,
    impact.monteCarlo.lifetimeLow,
    impact.monteCarlo.lifetimeHigh,
    impact.monteCarlo.dieLow,
    impact.monteCarlo.dieHigh,
    impact.monteCarlo.latchupLow,
    impact.monteCarlo.latchupHigh,
  ];
}

describe("chip impact property", () => {
  it("keeps 50 random specs finite and marks missing dependencies as estimates", () => {
    const rng = mulberry32(1963);
    for (let index = 0; index < 50; index += 1) {
      const spec = randomSpec(rng, index);
      expect(chipSpecSchema.safeParse(spec).success).toBe(true);
      const impact = simulateImpact({ spec, payload: PAYLOAD, kp: 2 + rng() * 6 });
      for (const value of numbersOf(impact)) {
        expect(Number.isFinite(value)).toBe(true);
      }
      if (spec.seuCrossSection === undefined) {
        expect(impact.crossSection.isEstimate).toBe(true);
        expect(impact.upsetRate.isEstimate).toBe(true);
      }
      if (spec.tidLimitKradSi === undefined) {
        expect(impact.tidLimit.isEstimate).toBe(true);
        expect(impact.lifetimeYears.isEstimate).toBe(true);
      }
      if (spec.latchupLet === undefined) {
        expect(impact.latchupLet.isEstimate).toBe(true);
      }
      if (spec.dieArea === undefined) {
        expect(impact.dieAreaCm2.isEstimate).toBe(true);
      }
    }
  });
});
