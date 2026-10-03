import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { filterGoesSep } from "@/lib/data/donki";
import { gscale } from "@/lib/engine/gscale";
import { type FeedId, filterActiveAscending, filterPredictedKp, normalizeFeed } from "@/lib/data/swpc";

describe("RTSW active filter", () => {
  it("keeps only active SOLAR1, ACE, and IMAP rows, ascending", () => {
    const fixture = [
      { time_tag: "2026-10-03T00:03:00", active: true, source: "ACE", proton_speed: 1 },
      { time_tag: "2026-10-03T00:01:00", active: true, source: "SOLAR1", proton_speed: 1 },
      { time_tag: "2026-10-03T00:02:00", active: false, source: "IMAP", proton_speed: 1 },
      { time_tag: "2026-10-03T00:02:00", active: true, source: "IMAP", proton_speed: 1 },
    ];

    const rows = filterActiveAscending(fixture);

    expect(rows.every((row) => row.active === true)).toBe(true);
    expect(rows.map((row) => row.source)).toEqual(["SOLAR1", "IMAP", "ACE"]);
    expect(rows.map((row) => row.time_tag)).toEqual([
      "2026-10-03T00:01:00",
      "2026-10-03T00:02:00",
      "2026-10-03T00:03:00",
    ]);
  });
});

describe("feed normalize", () => {
  it("drops observed Kp forecast rows", () => {
    const rows = filterPredictedKp([
      { time_tag: "2026-10-03T00:00:00", observed: "observed", kp: 3 },
      { time_tag: "2026-10-03T03:00:00", observed: "predicted", kp: 4 },
    ]);
    expect(rows).toEqual([{ time_tag: "2026-10-03T03:00:00", observed: "predicted", kp: 4 }]);
  });

  it("parses a mixed wind payload down to active rows", () => {
    const parsed = normalizeFeed("rtsw_wind_1m", [
      {
        time_tag: "2026-10-03T00:02:00",
        active: false,
        source: "ACE",
        proton_speed: 400,
        proton_density: 2,
        proton_temperature: 1,
        proton_vx_gse: null,
        proton_vy_gse: null,
        proton_vz_gse: null,
        proton_vx_gsm: null,
        proton_vy_gsm: null,
        proton_vz_gsm: null,
      },
      {
        time_tag: "2026-10-03T00:01:00",
        active: true,
        source: "SOLAR1",
        proton_speed: 410,
        proton_density: 3,
        proton_temperature: 2,
        proton_vx_gse: 1,
        proton_vy_gse: 1,
        proton_vz_gse: 1,
        proton_vx_gsm: 1,
        proton_vy_gsm: 1,
        proton_vz_gsm: 1,
      },
    ]);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect((parsed as { source: string }[])[0]?.source).toBe("SOLAR1");
  });
});

describe("gscale", () => {
  it("maps 5.333 to G1 and 4.67 to G0", () => {
    expect(gscale(5.333)).toBe("G1");
    expect(gscale(4.67)).toBe("G0");
    expect(gscale(9)).toBe("G5");
  });
});

describe("snapshot schemas", () => {
  const feeds: FeedId[] = [
    "kp",
    "kp_1m",
    "kp_forecast",
    "scales",
    "goes_protons",
    "goes_xrays",
    "rtsw_wind_1m",
    "rtsw_mag_1m",
    "dst",
    "aurora",
    "f107",
    "forecast_3day",
    "celestrak_gp",
    "celestrak_supgp",
    "celestrak_satcat",
    "satcat_2022-010",
  ];

  for (const feed of feeds) {
    it(`parses data/snapshots/${feed}.json`, () => {
      const filePath = path.join(process.cwd(), "data", "snapshots", `${feed}.json`);
      const payload = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
      expect(normalizeFeed(feed, payload)).toBeTruthy();
    });
  }
});

describe("DONKI SEP", () => {
  it("keeps rows whose instrument displayName contains GOES", () => {
    const rows = filterGoesSep([
      { instruments: [{ displayName: "GOES-16" }] },
      { instruments: [{ displayName: "REleASE" }] },
      { instruments: [] },
    ]);
    expect(rows).toHaveLength(1);
  });
});
