import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { DERIVED_SHELL } from "@/lib/engine/orbit/derivedShell";
import { largestShell } from "@/lib/engine/orbit/shellCluster";

describe("largest shell", () => {
  it("matches the locked means from the CelesTrak snapshot", () => {
    const raw = JSON.parse(readFileSync("data/snapshots/celestrak_gp.json", "utf8")) as {
      INCLINATION: number;
      MEAN_MOTION: number;
    }[];
    const cluster = largestShell(
      raw.map((row) => ({ inclinationDeg: row.INCLINATION, meanMotionRevPerDay: row.MEAN_MOTION })),
    );
    expect(cluster.count).toBeGreaterThan(3000);
    expect(cluster.meanInclinationDeg).toBeGreaterThan(53);
    expect(cluster.meanInclinationDeg).toBeLessThan(54);
    expect(cluster).toEqual(DERIVED_SHELL);
  });
});
