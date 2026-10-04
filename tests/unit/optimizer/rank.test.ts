import { describe, expect, it } from "vitest";

import { defaultRankOptions, rankOrbits, type ScoreWeights } from "@/lib/engine/orbit/optimizer";

describe("rankOrbits", () => {
  it("is deterministic, including when the candidate order is not the input order", () => {
    const options = defaultRankOptions();
    const first = rankOrbits(options);
    const second = rankOrbits(options);
    expect(second).toEqual(first);
    const shuffled = rankOrbits(options);
    expect(shuffled.map((row) => row.altitudeKm)).toEqual(first.map((row) => row.altitudeKm));
    expect(first[0]?.score).toBe(Math.min(...first.map((row) => row.score)));
  });

  it("does not move the best orbit to a higher dose when the dose weight rises", () => {
    const base = defaultRankOptions();
    const before = rankOrbits(base)[0];
    const heavier: ScoreWeights = { upset: 0.1, dose: 0.8, lifetime: 0.05, thermal: 0.05 };
    const after = rankOrbits({ ...base, weights: heavier })[0];
    expect(before).toBeDefined();
    expect(after).toBeDefined();
    expect(after!.annualDose).toBeLessThanOrEqual(before!.annualDose + 1e-9);
  });

  it("never shortens TID lifetime when the TID limit rises", () => {
    const base = defaultRankOptions();
    const low = rankOrbits({
      ...base,
      spec: { ...base.spec, tidLimitKradSi: 2 },
    });
    const high = rankOrbits({
      ...base,
      spec: { ...base.spec, tidLimitKradSi: 20 },
    });
    for (const row of low) {
      const match = high.find((item) => item.altitudeKm === row.altitudeKm && item.ltanHours === row.ltanHours);
      expect(match).toBeDefined();
      expect(match!.tidYears).toBeGreaterThanOrEqual(row.tidYears - 1e-9);
    }
  });
});
