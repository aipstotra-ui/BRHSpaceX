import { describe, expect, it } from "vitest";
import { z } from "zod";

import { replayOnOrbit } from "@/lib/engine/replayOnOrbit";
import { EVENTS, eventById, eventForMode, eventStats, stormCallStats } from "@/lib/events/registry";

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
const nullableNumber = z.number().finite().nullable();
const replaySchema = z.object({
  label: z.string().min(1),
  window: z.tuple([iso, iso]),
  markers: z.record(z.string(), z.array(iso)),
  aiForecast: z.object({
    note: z.string(),
    rows: z.array(
      z.object({ issued: iso, horizonH: z.number(), target: iso, p10: z.number(), p50: z.number(), p90: z.number() }),
    ),
    firstWarning: z.unknown(),
  }),
  hours: z
    .array(
      z.object({
        time: iso,
        kp: nullableNumber,
        dst: nullableNumber,
        gLevel: z.string().nullable(),
        forecastKpP50: nullableNumber,
        goesProtonFlux: nullableNumber.optional(),
      }),
    )
    .min(24),
});

describe("event registry", () => {
  for (const event of EVENTS) {
    describe(event.id, () => {
      it("has a well-formed replay file", () => {
        expect(() => replaySchema.parse(event.replay)).not.toThrow();
      });

      it("covers its window hour by hour, and its markers fall inside it", () => {
        const [start, end] = event.replay.window.map((value) => Date.parse(value));
        const times = event.replay.hours.map((hour) => Date.parse(hour.time));
        expect(times[0]).toBe(start);
        expect(times[times.length - 1]).toBe(end);
        for (let index = 1; index < times.length; index += 1) {
          expect(times[index] - times[index - 1]).toBe(3_600_000);
        }
        for (const marker of event.markers) {
          expect(Date.parse(marker.time)).toBeGreaterThanOrEqual(start);
          expect(Date.parse(marker.time)).toBeLessThanOrEqual(end);
        }
      });

      it("is reachable as a timeline mode", () => {
        expect(eventForMode(event.id)).toBe(event);
        expect(eventById(event.id)).toBe(event);
      });
    });
  }

  it("is not a mode for the live window", () => {
    expect(eventForMode("now")).toBeNull();
  });

  it("reports the May 2024 headline numbers from the data", () => {
    const stats = eventStats(eventById("may2024").replay);
    expect(stats.peakKp).toBe(9);
    expect(stats.minDst).toBe(-406);
    expect(stats.peakProtonPfu).toBeGreaterThan(100);
    // The hand-written text this replaces said "10 of 12, it missed the onset".
    expect(stormCallStats(eventById("may2024").replay)).toEqual({
      blocks: 12,
      medianBelowAll: true,
      p90Reached: 10,
      missedFirst: true,
    });
  });

  it("replays May 2024 by default, exactly as when named", () => {
    expect(replayOnOrbit(700, 500)).toEqual(replayOnOrbit(700, 500, "may2024"));
  });
});
