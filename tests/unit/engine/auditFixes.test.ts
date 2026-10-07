import { describe, expect, it } from "vitest";

import {
  DRAM_UNCORRECTABLE_CM2_PER_BIT,
  HBM_RAD_PER_UNCORRECTABLE,
  HBM_TEST_BITS,
  isDram,
  PROTON_67MEV_SI_MEV_CM2_G,
} from "@/lib/engine/chipModel";
import { simulateImpact, SNAPSHOT_KP } from "@/lib/engine/impact";
import { densityKgM3, DENSITY_TABLE } from "@/lib/engine/orbit/density";
import { ACTIVITY_MID, VEHICLE_CD, VEHICLE_DRAG_AREA_M2, VEHICLE_EOL_KM, VEHICLE_MASS_KG } from "@/lib/engine/orbit/constants";
import { orbitImpact } from "@/lib/engine/orbitImpact";
import { dragAging } from "@/lib/engine/stormLife";
import { getPreset } from "@/lib/presets";

const vehicle = { massKg: VEHICLE_MASS_KG, dragAreaM2: VEHICLE_DRAG_AREA_M2, cd: VEHICLE_CD, eolAltitudeKm: VEHICLE_EOL_KM };

function presetOrbit(id: string, altitudeKm = 550) {
  const preset = getPreset(id);
  return orbitImpact({
    altitudeKm,
    inclinationDeg: 53,
    sunSynchronous: false,
    ltanHours: null,
    raanDeg: 0,
    vehicle,
    spec: preset.spec,
    payload: preset.payload,
    memoryUnit: preset.memoryUnit,
    nodeKnown: preset.nodeKnown,
    deviceSeu: preset.deviceSeu,
  });
}

describe("DRAM upsets are uncorrectable errors anchored on the Suncatcher HBM test", () => {
  it("reproduces one uncorrectable error per 50 rad of 67 MeV protons on 32 GB", () => {
    const fluencePerRad = 1 / (1.602176634e-8 * PROTON_67MEV_SI_MEV_CM2_G);
    const chip = DRAM_UNCORRECTABLE_CM2_PER_BIT * HBM_TEST_BITS;
    expect(chip * fluencePerRad * HBM_RAD_PER_UNCORRECTABLE).toBeCloseTo(1, 9);
    expect(chip).toBeGreaterThan(2e-9);
    expect(chip).toBeLessThan(3e-9);
  });

  it("classifies DRAM by memory type and leaves SRAM, flash and measured devices raw", () => {
    for (const type of ["HBM4", "HBM3", "HBM", "LPDDR5", "DDR4", "GDDR6"]) {
      expect(isDram(type)).toBe(true);
    }
    expect(isDram("Flash")).toBe(false);
    const kind = (id: string) => {
      const preset = getPreset(id);
      return simulateImpact({
        spec: preset.spec,
        payload: preset.payload,
        kp: SNAPSHOT_KP,
        memoryUnit: preset.memoryUnit,
        nodeKnown: preset.nodeKnown,
        deviceSeu: preset.deviceSeu,
      }).upsetKind;
    };
    expect(kind("tpu-v6e")).toBe("uncorrectable");
    expect(kind("ai1-spacex")).toBe("uncorrectable");
    expect(kind("orin-nx")).toBe("raw");
    expect(kind("samrh71")).toBe("raw");
  });

  it("puts a TPU v6e within an order of magnitude of Google's dose-based rate", () => {
    // Google: ~150 rad(Si)/yr shielded, one uncorrectable error per ~50 rad, so a few per year.
    const perYear = presetOrbit("tpu-v6e").upsetRate.mid * 365.25 * 86400;
    expect(perYear).toBeGreaterThan(0.3);
    expect(perYear).toBeLessThan(30);
  });
});

describe("thermal margin needs real inputs", () => {
  it("is not computed for chips without power, radiator, or a temperature limit", () => {
    const h100 = presetOrbit("h100-starcloud");
    expect(h100.thermalKnown).toBe(false);
    expect(h100.thermalMarginC.label).toBe("UNVERIFIED");
    const ai1 = presetOrbit("ai1-spacex");
    expect(ai1.thermalKnown).toBe(true);
  });

  it("does not flag peak power against a radiator that was never given", () => {
    const preset = getPreset("orin-nx");
    const impact = simulateImpact({ spec: preset.spec, payload: preset.payload, kp: SNAPSHOT_KP, deviceSeu: preset.deviceSeu });
    expect(impact.thermal.inputsKnown).toBe(false);
    expect(impact.thermal.peakFlag).toBe(false);
  });
});

describe("storm drag uses NRLMSIS density at the storm's Ap", () => {
  it("charges extra drag-life days per storm day, rising with the G level", () => {
    const storms = presetOrbit("ai1-spacex", 462).storms;
    const days = storms.map((storm) => storm.dragDaysPerStormDay.mid);
    for (let index = 1; index < days.length; index += 1) {
      expect(days[index]).toBeGreaterThan(days[index - 1]);
    }
    expect(days[4]).toBeCloseTo(dragAging(462, 9) - 1, 9);
    expect(days[4]).toBeGreaterThan(1);
  });
});

describe("density interpolation", () => {
  it("is log-linear in altitude between table nodes", () => {
    const below = densityKgM3(400, ACTIVITY_MID);
    const above = densityKgM3(425, ACTIVITY_MID);
    expect(DENSITY_TABLE.altitudesKm).toContain(400);
    expect(densityKgM3(412.5, ACTIVITY_MID)).toBeCloseTo(Math.sqrt(below * above), 20);
  });
});
