import snapshot from "@/data/snapshots/starlink_demo.json";

import type { OmmRecord } from "@/lib/engine/propagate";

export interface StarlinkDemoRecord extends OmmRecord {
  NORAD_CAT_ID: number;
  EPOCH: string;
  INCLINATION: number;
  MEAN_MOTION: number;
  shellDeg: number | string;
  altitudeKm: number;
  raisingOrDeorbiting: boolean;
}

const demo = snapshot as unknown as {
  product: string;
  sourceFile: string;
  downloadedAtUtc: string;
  downloadTimeNote: string;
  factCheckUtc: string;
  dataSource: string | null;
  budget: number;
  totalInSnapshot: number;
  noradAtLeast100000: number;
  sampleCounts: Record<string, number>;
  below440InSample: number;
  below440Note: string;
  records: StarlinkDemoRecord[];
};

export const starlinkDemo = demo;

export function starlinkRecords(): StarlinkDemoRecord[] {
  return demo.records;
}
