import { describe, expect, it } from "vitest";

import { HISTORY_END, HISTORY_START, levelsFor, safetyReading, severeShare } from "@/lib/demo/safety";

describe("judge safety score", () => {
  it("uses measured years from 1963 through the latest year", () => {
    expect(HISTORY_START).toBe(1963);
    expect(HISTORY_END).toBeGreaterThanOrEqual(2024);
    expect(severeShare(levelsFor({ kind: "past", year: 2003 }))).toBeGreaterThan(0);
  });

  it("treats a stormy Sun as rougher than a quiet Sun", () => {
    const quiet = severeShare(levelsFor({ kind: "mission", window: "quiet" }));
    const stormy = severeShare(levelsFor({ kind: "mission", window: "stormy" }));
    expect(stormy).toBeGreaterThan(quiet);
  });

  it("maps a calm orbit to Safe and a hot, short-lived orbit to Unsafe", () => {
    const calm = safetyReading({
      saa: 0.02,
      eclipse: 0.2,
      thermalMarginC: 20,
      lifetimeYears: 8,
      severeShare: 0.001,
    });
    const rough = safetyReading({
      saa: 0.4,
      eclipse: 0.9,
      thermalMarginC: -30,
      lifetimeYears: 1,
      severeShare: 0.08,
      liveKp: 8,
    });
    expect(calm.word).toBe("Safe");
    expect(calm.score).toBeGreaterThanOrEqual(75);
    expect(rough.word).toBe("Unsafe");
    expect(rough.score).toBeLessThan(45);
    expect(rough.reasons[0]?.length).toBeGreaterThan(0);
  });
});
