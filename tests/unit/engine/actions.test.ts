import { describe, expect, it } from "vitest";

import { ACTION_ORDER, POLICY_COSTS } from "@/lib/engine/actions";

describe("policy costs", () => {
  it("labels every action cost as an estimate", () => {
    expect(POLICY_COSTS.label).toBe("estimate");
    expect(ACTION_ORDER).toEqual(["continue", "checkpoint", "throttle", "safe mode"]);
    for (const name of ACTION_ORDER) {
      expect(POLICY_COSTS.actions[name].label).toBe("estimate");
    }
  });
});
