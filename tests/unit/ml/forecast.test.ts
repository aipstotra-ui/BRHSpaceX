import { describe, expect, it } from "vitest";

import { calibrateQuantiles, sortQuantiles } from "@/lib/ml/forecast";

describe("quantile display order", () => {
  it("sorts P10, P50, and P90 before display", () => {
    expect(sortQuantiles(4, 1, 3)).toEqual({ p10: 1, p50: 3, p90: 4 });
  });

  it("clips Kp and keeps the ordered band inside 0 to 9", () => {
    const band = calibrateQuantiles("kp", -1, 10, 4, 0.5);
    expect(band.p10).toBeGreaterThanOrEqual(0);
    expect(band.p90).toBeLessThanOrEqual(9);
    expect(band.p10).toBeLessThanOrEqual(band.p50);
    expect(band.p50).toBeLessThanOrEqual(band.p90);
  });
});
