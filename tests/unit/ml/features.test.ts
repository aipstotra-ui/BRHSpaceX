import { describe, expect, it } from "vitest";

import {
  computeFeatureMap,
  ffillLimit3,
  livePdyn,
  rollingMean,
  type HourlyColumns,
} from "@/lib/ml/features";

describe("live feature windows", () => {
  it("fills at most three missing hours and averages the trailing window", () => {
    expect(ffillLimit3([1, null, null, null, null])).toEqual([1, 1, 1, 1, null]);
    const filled = ffillLimit3([1, 2, null, 4, 5, 6]);
    expect(rollingMean(filled, 3)[2]).toBeCloseTo((1 + 2 + 2) / 3);
  });

  it("uses the OMNI alpha-missing dynamic pressure branch", () => {
    expect(livePdyn(2, 400)).toBeCloseTo((2.0 / 1e6) * 2 * 400 * 400);
  });

  it("reads the last completed Kp block and a 3-hour Bz mean", () => {
    const times = Array.from({ length: 6 }, (_, hour) =>
      new Date(Date.UTC(2024, 4, 11, hour)).toISOString(),
    );
    const hourly: HourlyColumns = {
      times,
      bz_gsm: [1, 2, 3, 4, 5, 6],
      by_gsm: [0, 0, 0, 0, 0, 0],
      speed: [400, 400, 400, 400, 400, 400],
      density: [5, 5, 5, 5, 5, 5],
      pdyn: [1, 1, 1, 1, 1, 1],
      kp: [9, 9, 9, 8, 8, 8],
      dst: [-10, -12, -14, -16, -18, -20],
      f107: [100, 100, 100, 110, 110, 110],
    };
    const features = computeFeatureMap(hourly, times[3]);
    expect(features.kp_block_lag0).toBe(9);
    expect(features.bz_gsm_mean3).toBeCloseTo((2 + 3 + 4) / 3);
    expect(features.dst_lag0).toBe(-16);
    expect(features.f107_lag24).toBeNull();
  });
});
