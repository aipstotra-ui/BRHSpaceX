import { describe, expect, it } from "vitest";

import { simulateImpact, SNAPSHOT_KP, type ImpactResult } from "@/lib/engine/impact";
import { PRESETS } from "@/lib/presets";

function compact(impact: ImpactResult) {
  return {
    upset: impact.upsetRate.value,
    crossSection: impact.crossSection.value,
    crossUnit: impact.crossSection.unit,
    crossEstimate: impact.crossSection.isEstimate,
    correctable: impact.correctable.value,
    due: impact.due.value,
    sdc: impact.sdc.value,
    annual: impact.annualDose.value,
    fiveYearLabel: impact.fiveYearDose.label,
    lifetime: impact.lifetimeYears.value,
    tid: impact.tidLimit.value,
    tidEstimate: impact.tidLimit.isEstimate,
    latchup: impact.latchupLet.value,
    latchupLabel: impact.latchupLet.label,
    die: impact.dieAreaCm2.value,
    dieEstimate: impact.dieAreaCm2.isEstimate,
    storm: impact.storm.value,
    bits: impact.bits.value,
    mcLow: impact.monteCarlo.upsetLow,
    mcHigh: impact.monteCarlo.upsetHigh,
    temperatureK: impact.thermal.radiatorTemperatureK.value,
    kwPerM2: impact.thermal.kwPerM2.value,
    peakFlag: impact.thermal.peakFlag,
    areaAvg320: impact.thermal.areaAvg320.value,
    areaAvg340: impact.thermal.areaAvg340.value,
  };
}

describe("preset impacts", () => {
  it("does not scale the Orin NX device cross-section by bit count", () => {
    const preset = PRESETS.find((item) => item.id === "orin-nx");
    expect(preset).toBeDefined();
    if (!preset) {
      return;
    }
    const base = simulateImpact({
      spec: preset.spec,
      payload: preset.payload,
      kp: SNAPSHOT_KP,
      memoryUnit: preset.memoryUnit,
      nodeKnown: preset.nodeKnown,
      deviceSeu: preset.deviceSeu,
    });
    const doubled = simulateImpact({
      spec: { ...preset.spec, memoryCapacity: preset.spec.memoryCapacity * 2 },
      payload: preset.payload,
      kp: SNAPSHOT_KP,
      memoryUnit: preset.memoryUnit,
      nodeKnown: preset.nodeKnown,
      deviceSeu: preset.deviceSeu,
    });
    expect(base.upsetRate.value).toBeCloseTo(doubled.upsetRate.value);
    expect(base.crossSection.unit).toBe("cm2");
    expect(base.crossSection.isEstimate).toBe(false);
  });

  it("counts SAMRH71 flash as 128 decimal kilobytes", () => {
    const preset = PRESETS.find((item) => item.id === "samrh71");
    expect(preset).toBeDefined();
    if (!preset) {
      return;
    }
    const impact = simulateImpact({
      spec: preset.spec,
      payload: preset.payload,
      kp: SNAPSHOT_KP,
      memoryUnit: preset.memoryUnit,
      nodeKnown: preset.nodeKnown,
    });
    expect(impact.bits.value).toBe(128 * 1000 * 8);
    expect(impact.bits.isEstimate).toBe(true);
    expect(impact.latchupLet.value).toBe(62.5);
    expect(impact.tidLimit.value).toBe(100);
  });

  it.each(PRESETS.map((preset) => [preset.id, preset] as const))("snapshot %s", (_id, preset) => {
    const impact = simulateImpact({
      spec: preset.spec,
      payload: preset.payload,
      kp: SNAPSHOT_KP,
      memoryUnit: preset.memoryUnit,
      nodeKnown: preset.nodeKnown,
      deviceSeu: preset.deviceSeu,
      ratioLabel:
        preset.labels.avgPowerKw === "source" && preset.payloadLabels.radiatorAreaM2 === "source"
          ? "source"
          : "estimate",
    });
    expect(compact(impact)).toMatchSnapshot();
  });
});
