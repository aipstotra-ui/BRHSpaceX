import { describe, expect, it } from "vitest";

import may2024 from "@/data/replays/may2024.json";
import { ssoInclinationDeg } from "@/lib/engine/orbit/sso";
import { agingAt, dragAging, extraLifeUsedDays, kpToAp, sepDoseRadPerYear } from "@/lib/engine/stormLife";
import { chipProfile, decide, policyVector, POLICY_FEATURES } from "@/lib/ml/policyInput";

const shell = { altitudeKm: 463, inclinationDeg: 53.2, sunSynchronous: false, ltanHours: null, raanDeg: 0 };
const sso = { altitudeKm: 463, inclinationDeg: ssoInclinationDeg(463), sunSynchronous: true, ltanHours: 6, raanDeg: 0 };

describe("storm aging", () => {
  it("maps Kp to ap with the standard table", () => {
    expect(kpToAp(0)).toBe(0);
    expect(kpToAp(5)).toBeCloseTo(48, 6);
    expect(kpToAp(9)).toBe(400);
  });

  it("speeds up orbital decay in a storm and slows it when quiet", () => {
    expect(dragAging(463, 9)).toBeGreaterThan(3);
    expect(dragAging(463, 1)).toBeLessThan(1);
  });

  it("adds solar-proton dose only during an S1+ event", () => {
    expect(sepDoseRadPerYear(sso, 5, 1)).toBe(0);
    expect(sepDoseRadPerYear(sso, 5, 100)).toBeGreaterThan(0);
    expect(agingAt("TID", sso, 4.4, 5, 100).binding).toBeGreaterThan(1);
  });

  it("uses extra life over the May 2024 storm, and none on a quiet stretch", () => {
    const points = may2024.hours.map((hour) => ({
      timeMs: Date.parse(hour.time),
      kp: hour.kp,
      protonPfu: hour.goesProtonFlux,
    }));
    const whole = extraLifeUsedDays(points, points.length - 1, "drag", shell, 2.7);
    expect(whole).toBeGreaterThan(1);
    expect(extraLifeUsedDays(points.slice(0, 24), 23, "drag", shell, 2.7)).toBeLessThan(0.1);
  });
});

describe("policy inputs", () => {
  const context = {
    kp: 7,
    forecast: { p10: 5, p50: 7, p90: 8.5 },
    dst: -150,
    saa: 0.2,
    auroral: 0.1,
    eclipse: 0.3,
    presetId: "orin-nx",
  };

  it("builds the 11 features in training order with the nearest chip profile", () => {
    const vector = policyVector(context);
    expect(vector.length).toBe(POLICY_FEATURES.length);
    expect(Array.from(vector.slice(0, 5))).toEqual([7, 5, 7, 8.5, -150]);
    expect(chipProfile("orin-nx").exact).toBe(false);
    expect(Array.from(vector.slice(8))).toEqual([2, 2, 0.7].map((value) => Math.fround(value)));
  });

  it("reads the most likely action and notes a cost-check override", () => {
    const decision = decide([0.1, 0.2, 0.6, 0.1], context);
    expect(decision.model).toBe("throttle");
    expect(decision.confidence).toBeCloseTo(0.6, 6);
    expect(decision.overridden).toBe(decision.final !== "throttle");
  });
});
