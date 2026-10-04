import { degreesLat, degreesLong, eciToGeodetic, gstime, json2satrec, propagate } from "satellite.js";
import { describe, expect, it } from "vitest";

import { circularPositionKm } from "@/lib/engine/orbit/eclipse";
import { circularElements } from "@/lib/engine/orbit/elements";
import { raanAfterSeconds } from "@/lib/engine/orbit/j2";
import { createPropagateState, propagateSatrec, runPropagate, starmindAt } from "@/lib/engine/propagate";
import { runPropagate as workerRunPropagate } from "@/lib/engine/propagate.worker";
import { exposureClass } from "@/lib/engine/propagate";
import { inSaaContour } from "@/lib/engine/saaContour";
import { STARLINK_POINT_BUDGET } from "@/lib/engine/starlinkSample";
import { starlinkRecords } from "@/lib/globe/starlinkDemo";
import contour from "@/data/orbit/saa_igrf14.json";

describe("OMM propagation", () => {
  const records = starlinkRecords();
  const record = records.find((item) => Number(item.NORAD_CAT_ID) >= 100000);
  const orbit = {
    altitudeKm: 550,
    inclinationDeg: 97.4,
    sunSynchronous: false,
    ltanHours: null,
    raanDeg: 20,
  };
  const originMs = Date.parse("2026-10-03T12:00:00Z");
  const epochMs = originMs + 5400 * 1000;

  it("keeps a 6-digit NORAD id inside the 2,000 point subsample", () => {
    expect(records.length).toBeLessThanOrEqual(STARLINK_POINT_BUDGET);
    expect(records.length).toBeGreaterThan(0);
    expect(record).toBeDefined();
    expect(String(record?.NORAD_CAT_ID)).toHaveLength(6);
  });

  it("matches satellite.js json2satrec on the main thread for one OMM record", () => {
    expect(record).toBeDefined();
    if (!record) {
      return;
    }
    const date = new Date(epochMs);
    const fromWorker = workerRunPropagate(
      { epochMs, originMs, orbit, records: [record] },
      createPropagateState(),
    );
    const satrec = json2satrec(record);
    const propagated = propagate(satrec, date);
    const position = propagated?.position;
    expect(typeof position).toBe("object");
    if (!position || typeof position !== "object") {
      return;
    }
    const geodetic = eciToGeodetic(position, gstime(date));
    const direct = propagateSatrec(satrec, date);
    expect(fromWorker.positions[0]).toBeCloseTo(degreesLat(geodetic.latitude), 5);
    expect(fromWorker.positions[1]).toBeCloseTo(degreesLong(geodetic.longitude), 5);
    expect(fromWorker.positions[2]).toBeCloseTo(geodetic.height, 3);
    expect(direct?.latDeg).toBeCloseTo(fromWorker.positions[0], 5);
  });

  it("matches j2.ts for the Starmind position at the same epoch", () => {
    const fromWorker = runPropagate({ epochMs, originMs, orbit }, createPropagateState());
    const seconds = (epochMs - originMs) / 1000;
    const elements = circularElements(orbit, 0);
    const raanDeg = raanAfterSeconds(elements.raanDeg, elements.altitudeKm, elements.inclinationDeg, seconds);
    const argumentDeg = ((seconds / elements.periodS) * 360 + 360) % 360;
    const radiusKm = elements.semiMajorM / 1000;
    const position = circularPositionKm(radiusKm, elements.inclinationDeg, raanDeg, argumentDeg);
    const direct = starmindAt(orbit, seconds);
    expect(fromWorker.starmind.xKm).toBeCloseTo(position.x, 6);
    expect(fromWorker.starmind.yKm).toBeCloseTo(position.y, 6);
    expect(fromWorker.starmind.zKm).toBeCloseTo(position.z, 6);
    expect(fromWorker.starmind.raanDeg).toBeCloseTo(raanDeg, 6);
    expect(direct.xKm).toBeCloseTo(position.x, 6);
  });

  it("logs one tick over the subsampled Starlink set", () => {
    const result = workerRunPropagate({ epochMs, originMs, orbit, records }, createPropagateState());
    console.log("WORKER_TICK_MS", result.ms);
    expect(result.positions.length).toBe(records.length * 3);
    expect(result.ms).toBeGreaterThan(0);
    expect(Number.isFinite(result.positions[0])).toBe(true);
  });
});

describe("exposure classification", () => {
  const inside = contour.fixtures.inside;

  it("classifies the IGRF contour fixture as SAA", () => {
    expect(inside.latDeg).toBeLessThan(-30);
    expect(inSaaContour(inside.latDeg, inside.lonDeg, inside.altitudeKm)).toBe(true);
    expect(exposureClass(inside.latDeg, inside.lonDeg, inside.altitudeKm)).toBe("SAA");
  });

  it("classifies an auroral-band point as auroral", () => {
    expect(exposureClass(70, 10, 500)).toBe("auroral");
  });

  it("classifies a point outside every band as nominal", () => {
    expect(inSaaContour(15, 25, 500)).toBe(false);
    expect(exposureClass(15, 25, 500)).toBe("nominal");
  });
});
