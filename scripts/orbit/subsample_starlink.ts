import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  altitudeKmFromMeanMotion,
  raisingOrDeorbiting,
  shellCenterDeg,
  STARLINK_POINT_BUDGET,
  subsampleStarlink,
} from "../../lib/engine/starlinkSample.ts";

const root = resolve(import.meta.dirname, "../..");
const supgpPath = resolve(root, "data/snapshots/celestrak_supgp.json");
const gpPath = resolve(root, "data/snapshots/celestrak_gp.json");

function load(path: string): Record<string, unknown>[] {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>[];
}

let product = "supgp";
let sourceFile = "data/snapshots/celestrak_supgp.json";
let records: Record<string, unknown>[];
try {
  records = load(supgpPath);
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("empty supgp");
  }
} catch {
  product = "gp";
  sourceFile = "data/snapshots/celestrak_gp.json";
  records = load(gpPath);
}

const typed = records.map((record) => ({
  ...record,
  INCLINATION: Number(record.INCLINATION),
  NORAD_CAT_ID: Number(record.NORAD_CAT_ID),
  MEAN_MOTION: Number(record.MEAN_MOTION),
}));

const shellCounts: Record<string, number> = {};
let below440 = 0;
for (const record of typed) {
  const key = String(shellCenterDeg(record.INCLINATION));
  shellCounts[key] = (shellCounts[key] ?? 0) + 1;
  if (raisingOrDeorbiting(altitudeKmFromMeanMotion(record.MEAN_MOTION))) {
    below440 += 1;
  }
}

const sampled = subsampleStarlink(typed, STARLINK_POINT_BUDGET);
const sampleCounts: Record<string, number> = {};
let below440Sample = 0;
const decorated = sampled.map((record) => {
  const altitudeKm = altitudeKmFromMeanMotion(record.MEAN_MOTION);
  const shell = shellCenterDeg(record.INCLINATION);
  const flagged = raisingOrDeorbiting(altitudeKm);
  const key = String(shell);
  sampleCounts[key] = (sampleCounts[key] ?? 0) + 1;
  if (flagged) {
    below440Sample += 1;
  }
  return {
    ...record,
    shellDeg: shell,
    altitudeKm,
    raisingOrDeorbiting: flagged,
  };
});

const payload = {
  product,
  sourceFile,
  downloadedAtUtc: "2026-10-03T20:02:58Z",
  downloadTimeNote:
    "UTC commit time of data/snapshots/celestrak_supgp.json in M2. The M6 fact-check at 2026-10-03T23:30:00Z reported the same SupGP size (5.09 MB, 11,152 records) and GP size (4.70 MB, 11,125 records). Not re-downloaded: CelesTrak allows one group download per 2 hours.",
  factCheckUtc: "2026-10-03T23:30:00Z",
  dataSource: product === "supgp" ? "SpaceX-E" : null,
  budget: STARLINK_POINT_BUDGET,
  totalInSnapshot: typed.length,
  noradAtLeast100000: typed.filter((record) => record.NORAD_CAT_ID >= 100000).length,
  shellCounts,
  sampleCounts,
  below440InSnapshot: below440,
  below440InSample: below440Sample,
  below440Note: "Altitude cutoff 440 km is the fact-check flag for raising or deorbiting. It is an estimate, not a published SpaceX threshold.",
  records: decorated,
};

const out = resolve(root, "data/snapshots/starlink_demo.json");
writeFileSync(out, JSON.stringify(payload));
console.log(
  `wrote ${out} product=${product} sample=${decorated.length} total=${typed.length} below440=${below440} sixDigit=${payload.noradAtLeast100000}`,
);
