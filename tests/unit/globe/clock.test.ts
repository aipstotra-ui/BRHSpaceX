import { describe, expect, it } from "vitest";

import { advance } from "@/lib/store/clock";
import { indexAt, liveReferenceMs, sampleAt, useTimelineStore, type TimelinePoint } from "@/lib/store/timeline";

const HOUR = 3_600_000;
const t0 = Date.UTC(2024, 4, 10, 0);
const points: TimelinePoint[] = [
  { timeMs: t0, kp: 2, protonPfu: 1, kind: "replay" },
  { timeMs: t0 + 3 * HOUR, kp: 5, protonPfu: 11, kind: "replay" },
  { timeMs: t0 + 6 * HOUR, kp: 8, protonPfu: null, kind: "replay" },
];

describe("timeline sampling", () => {
  it("finds the block that contains a time", () => {
    expect(indexAt(points, t0 - 1)).toBe(0);
    expect(indexAt(points, t0)).toBe(0);
    expect(indexAt(points, t0 + 3 * HOUR - 1)).toBe(0);
    expect(indexAt(points, t0 + 3 * HOUR)).toBe(1);
    expect(indexAt(points, t0 + 99 * HOUR)).toBe(2);
  });

  it("holds Kp for the block and interpolates protons between points", () => {
    const mid = sampleAt(points, t0 + 1.5 * HOUR);
    expect(mid.kp).toBe(2);
    expect(mid.protonPfu).toBeCloseTo(6, 9);
    // No interpolation towards a missing value.
    expect(sampleAt(points, t0 + 4 * HOUR).protonPfu).toBe(11);
  });

  it("moves the block index only when the clock crosses into another block", () => {
    const store = useTimelineStore.getState();
    store.setPoints(points, 0, t0);
    store.setSimTime(t0 + 2 * HOUR);
    expect(useTimelineStore.getState().index).toBe(0);
    store.setSimTime(t0 + 4 * HOUR);
    expect(useTimelineStore.getState().index).toBe(1);
    store.setSimTime(t0 + 50 * HOUR);
    expect(useTimelineStore.getState().simTimeMs).toBe(t0 + 6 * HOUR);
    store.setIndex(1);
    expect(useTimelineStore.getState().simTimeMs).toBe(t0 + 3 * HOUR);
  });
});

describe("clock", () => {
  it("advances by real time times speed, caps long frames and stops at the end", () => {
    expect(advance(0, 16, 3600, 1e12).simMs).toBe(16 * 3600);
    expect(advance(0, 5000, 60, 1e12).simMs).toBe(250 * 60);
    expect(advance(0, 50, 3600, 1000)).toEqual({ simMs: 1000, ended: true });
  });
});

describe("live window reference", () => {
  it("uses the wall clock for a fresh feed and the snapshot's newest block for a stale one", () => {
    const wall = Date.UTC(2026, 9, 7, 12);
    expect(liveReferenceMs([wall - 2 * HOUR], wall)).toEqual({ referenceMs: wall, stale: false });
    const old = Date.UTC(2026, 9, 3, 15);
    expect(liveReferenceMs([old - 3 * HOUR, old], wall)).toEqual({ referenceMs: old + 3 * HOUR, stale: true });
  });
});
