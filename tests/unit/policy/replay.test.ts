import { describe, expect, it } from "vitest";

import { actionCost } from "@/lib/engine/costCheck";
import { DEFAULT_ORBIT_KM, replayOnOrbit } from "@/lib/engine/replayOnOrbit";
import golden from "@/public/models/golden_policy.json";

describe("May 2024 replay", () => {
  it("marks the SEP onset and moves before 11 May", () => {
    const replay = replayOnOrbit(1100, DEFAULT_ORBIT_KM);
    expect(replay.markers.sepOnset[0]).toBe("2024-05-10T13:35:00Z");
    expect(replay.firstNonContinue).toBeTruthy();
    expect(replay.firstNonContinue! < "2024-05-11T00:00:00Z").toBe(true);
  });

  it("has zero deltas on the default orbit and flips sign when swapped", () => {
    const same = replayOnOrbit(DEFAULT_ORBIT_KM, DEFAULT_ORBIT_KM);
    expect(same.delta.cost).toBeCloseTo(0, 8);
    expect(same.delta.downtimeHours).toBeCloseTo(0, 8);
    expect(same.delta.uncorrectable).toBeCloseTo(0, 8);
    const forward = replayOnOrbit(2000, 500);
    const backward = replayOnOrbit(500, 2000);
    expect(forward.delta.cost).toBeCloseTo(-backward.delta.cost, 6);
    expect(forward.delta.uncorrectable).toBeCloseTo(-backward.delta.uncorrectable, 6);
  });
});

describe("golden policy cost", () => {
  it("matches the Python action cost for uncorrectable 4", () => {
    const actions = golden.ts_cost_inputs.actions.actions;
    expect(actionCost(4, "continue")).toBeCloseTo(
      actions.continue.downtime_hours + actions.continue.uncorrectable_weight * 4 + actions.continue.switch_cost,
      6,
    );
  });
});
