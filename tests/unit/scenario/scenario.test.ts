import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import ranges from "@/data/scenario/ranges.json";
import forecastFile from "@/data/snapshots/forecast_3day.json";
import { importDonki } from "@/lib/scenario/importDonki";
import { importNoaaKp } from "@/lib/scenario/importNoaa";
import { baselineKp, runScenario } from "@/lib/scenario/run";
import { scenarioSchema } from "@/lib/scenario/schema";

const future = "2099-01-01T00:00:00Z";

function sample(overrides: Record<string, unknown> = {}) {
  return {
    cmeSpeedKmS: 600,
    bzNt: -10,
    densityCm3: 10,
    durationH: 6,
    arrivalTime: future,
    ...overrides,
  };
}

describe("scenario bounds", () => {
  it("accepts the observed ends and rejects anything outside", () => {
    expect(scenarioSchema.safeParse(sample({ cmeSpeedKmS: ranges.speedKmS.min })).success).toBe(true);
    expect(scenarioSchema.safeParse(sample({ cmeSpeedKmS: ranges.speedKmS.max })).success).toBe(true);
    expect(scenarioSchema.safeParse(sample({ cmeSpeedKmS: ranges.speedKmS.min - 0.1 })).success).toBe(false);
    expect(scenarioSchema.safeParse(sample({ cmeSpeedKmS: ranges.speedKmS.max + 0.1 })).success).toBe(false);
    expect(scenarioSchema.safeParse(sample({ bzNt: Number.NaN })).success).toBe(false);
    expect(scenarioSchema.safeParse(sample({ densityCm3: Number.POSITIVE_INFINITY })).success).toBe(false);
    expect(scenarioSchema.safeParse(sample({ durationH: 0 })).success).toBe(false);
    expect(scenarioSchema.safeParse(sample({ durationH: -1 })).success).toBe(false);
    expect(scenarioSchema.safeParse(sample({ arrivalTime: "not-a-time" })).success).toBe(false);
    expect(scenarioSchema.safeParse(sample({ arrivalTime: "2000-01-01T00:00:00Z" })).success).toBe(false);
  });
});

describe("scenario results", () => {
  it("matches the live baseline when the storm lasts zero hours", () => {
    const result = runScenario(sample({ durationH: 0 }));
    expect(result.kp).toBe(baselineKp());
    expect(result.label).toBe("SCENARIO");
  });

  it("labels every result SCENARIO and warns outside the training range", () => {
    const result = runScenario(sample({ outsideTraining: true }));
    expect(result.label).toBe("SCENARIO");
    expect(result.warning).toBe("outside training range");
  });

  it("reads the NOAA Kp table from the snapshot", () => {
    const rows = importNoaaKp(forecastFile.text);
    const fromFile = forecastFile.text
      .split("\n")
      .filter((line) => /^\d{2}-\d{2}UT/.test(line.trim()))
      .flatMap((line) => (line.match(/\d+\.\d+/g) ?? []).slice(0, 3).map(Number));
    expect(rows).toHaveLength(fromFile.length);
    expect(rows.map((row) => row.kp)).toEqual(fromFile);
  });

  it("prefills DONKI speed and arrival only", () => {
    expect(importDonki({ speed: 750, time21_5: future })).toEqual({
      cmeSpeedKmS: 750,
      arrivalTime: future,
    });
  });
});

describe("snapshot file is the one the parser uses", () => {
  it("contains the issued product text", () => {
    const raw = readFileSync("data/snapshots/forecast_3day.json", "utf8");
    expect(raw).toContain("NOAA Kp index breakdown");
  });
});
