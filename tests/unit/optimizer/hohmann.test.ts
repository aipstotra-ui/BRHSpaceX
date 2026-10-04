import { describe, expect, it } from "vitest";

import { hohmannDeltaVMs } from "@/lib/engine/orbit/hohmann";

describe("hohmann", () => {
  it("is zero on the same altitude and symmetric", () => {
    expect(hohmannDeltaVMs(500, 500)).toBe(0);
    expect(hohmannDeltaVMs(500, 1000)).toBeCloseTo(hohmannDeltaVMs(1000, 500), 9);
  });

  it("matches the plan formula for 300 km to 35786 km within 0.01 km/s", () => {
    // WGS 84 μ and R_E in lib/engine/orbit/constants.ts, formula in docs/research/orbit-model.md.
    // 3.893 km/s rounds to 3.89 km/s.
    expect(hohmannDeltaVMs(300, 35786) / 1000).toBeCloseTo(3.893, 2);
  });
});
