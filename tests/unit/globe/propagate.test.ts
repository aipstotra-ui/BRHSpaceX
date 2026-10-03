import { readFileSync } from "node:fs";

import * as satellite from "satellite.js";
import { describe, expect, it } from "vitest";

import { propagateGp, type GpRecord } from "@/lib/engine/globe/sgp4";
import { STARLINK_POINT_CAP, subsampleShellIndexes } from "@/lib/engine/globe/subsample";
import { propagateStarlink, starmindNow } from "@/lib/engine/propagate.worker";
import { starmindPositionKm } from "@/lib/engine/orbit/j2";

describe("globe propagation", () => {
  it("matches satellite.js for one snapshot TLE", () => {
    const records = JSON.parse(readFileSync("data/snapshots/celestrak_gp.json", "utf8")) as GpRecord[];
    const record = records[0];
    const date = new Date(record.EPOCH);
    const fromWorker = propagateGp(record, date);
    const satrec = satellite.json2satrec(record as unknown as satellite.OMMJsonObjectV3);
    const pv = satellite.propagate(satrec, date);
    if (!pv || !pv.position || typeof pv.position === "boolean" || !fromWorker) {
      throw new Error("propagation failed");
    }
    const geo = satellite.eciToGeodetic(pv.position, satellite.gstime(date));
    expect(fromWorker.latDeg).toBeCloseTo(satellite.degreesLat(geo.latitude), 6);
    expect(fromWorker.lonDeg).toBeCloseTo(satellite.degreesLong(geo.longitude), 6);
    expect(fromWorker.altKm).toBeCloseTo(geo.height, 6);
    const batch = propagateStarlink([record], date.getTime());
    expect(batch[0]).toBeCloseTo(fromWorker.latDeg, 6);
    expect(batch[2]).toBeCloseTo(fromWorker.altKm, 6);
  });

  it("matches j2.ts for the Starmind fix", () => {
    const direct = starmindPositionKm(462.5739441337271, 53.15968545669517, 0, 1200);
    const fromWorker = starmindNow(462.5739441337271, 53.15968545669517, 0, 1_200_000);
    expect(fromWorker).toEqual(direct);
  });

  it("keeps the Starlink draw under 2000 points", () => {
    const records = JSON.parse(readFileSync("data/snapshots/celestrak_gp.json", "utf8")) as GpRecord[];
    const indexes = subsampleShellIndexes(
      records.map((record) => ({ inclinationDeg: record.INCLINATION, meanMotionRevPerDay: record.MEAN_MOTION })),
    );
    expect(indexes.length).toBeLessThanOrEqual(STARLINK_POINT_CAP);
    expect(indexes.length).toBeGreaterThan(1000);
    const started = performance.now();
    const picked = indexes.map((index) => records[index]);
    propagateStarlink(picked, new Date(records[0].EPOCH).getTime());
    console.log(`worker ms per tick ${performance.now() - started}`);
  });
});
