/**
 * Starlink shells from the fact-check inclination buckets, not FCC Gen1 altitudes.
 * Centers: 30 / 43 / 53 / 70 / 97.5°, tolerance ±1.6°.
 * Mean-motion altitude uses the same μ and equatorial radius as shellCluster.ts.
 */

export const SHELL_CENTERS_DEG = [30, 43, 53, 70, 97.5] as const;
export const SHELL_TOLERANCE_DEG = 1.6;
export const DEORBIT_ALTITUDE_KM = 440;
export const STARLINK_POINT_BUDGET = 2000;

const MU_KM3_S2 = 398600.4418;
const RE_KM = 6378.137;

export interface StarlinkElements {
  INCLINATION: number | string;
  NORAD_CAT_ID: number | string;
  MEAN_MOTION: number | string;
}

export function altitudeKmFromMeanMotion(meanMotionRevPerDay: number): number {
  const n = (meanMotionRevPerDay * 2 * Math.PI) / 86400;
  return Math.cbrt(MU_KM3_S2 / (n * n)) - RE_KM;
}

export function shellCenterDeg(inclinationDeg: number): number | "other" {
  let best: number | null = null;
  let bestDistance = SHELL_TOLERANCE_DEG;
  for (const center of SHELL_CENTERS_DEG) {
    const distance = Math.abs(inclinationDeg - center);
    if (distance <= bestDistance) {
      best = center;
      bestDistance = distance;
    }
  }
  return best ?? "other";
}

export function raisingOrDeorbiting(altitudeKm: number): boolean {
  return altitudeKm < DEORBIT_ALTITUDE_KM;
}

export function subsampleStarlink<T extends StarlinkElements>(
  records: T[],
  budget = STARLINK_POINT_BUDGET,
): T[] {
  const groups = new Map<string, T[]>();
  for (const record of records) {
    const key = String(shellCenterDeg(Number(record.INCLINATION)));
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => Number(a.NORAD_CAT_ID) - Number(b.NORAD_CAT_ID));
  }
  const total = [...groups.values()].reduce((sum, list) => sum + list.length, 0);
  if (total === 0) {
    return [];
  }
  const cap = Math.min(budget, total);
  const rows = [...groups.keys()].map((key) => {
    const count = groups.get(key)!.length;
    const exact = (count / total) * cap;
    return { key, count, take: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });
  let used = rows.reduce((sum, row) => sum + row.take, 0);
  rows.sort((a, b) => b.fraction - a.fraction || a.key.localeCompare(b.key));
  let guard = 0;
  while (used < cap && guard < cap + 2) {
    let added = false;
    for (const row of rows) {
      if (used >= cap) {
        break;
      }
      if (row.take < row.count) {
        row.take += 1;
        used += 1;
        added = true;
      }
    }
    if (!added) {
      break;
    }
    guard += 1;
  }
  const picked: T[] = [];
  for (const row of rows) {
    const group = groups.get(row.key)!;
    if (row.take <= 0) {
      continue;
    }
    const step = group.length / row.take;
    for (let index = 0; index < row.take; index += 1) {
      picked.push(group[Math.min(group.length - 1, Math.floor(index * step))]);
    }
  }
  return picked.slice(0, cap);
}
