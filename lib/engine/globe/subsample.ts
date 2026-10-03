import { shellGroups, type ShellRecord } from "@/lib/engine/orbit/shellCluster";

/** Cap for the single Starlink Points buffer. */
export const STARLINK_POINT_CAP = 2000;

/** Proportional draw from each dense shell. The cap is the plan limit. */
export function subsampleShellIndexes(records: ShellRecord[]): number[] {
  const groups = shellGroups(records).filter((group) => group.indexes.length > 0);
  const total = groups.reduce((sum, group) => sum + group.indexes.length, 0);
  if (total === 0) {
    return [];
  }
  if (total <= STARLINK_POINT_CAP) {
    return groups.flatMap((group) => group.indexes);
  }
  const raw = groups.map((group) => (STARLINK_POINT_CAP * group.indexes.length) / total);
  const alloc = raw.map((value) => Math.floor(value));
  let used = alloc.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, frac: value - alloc[index] }))
    .sort((a, b) => b.frac - a.frac);
  for (const item of order) {
    if (used >= STARLINK_POINT_CAP) {
      break;
    }
    alloc[item.index] += 1;
    used += 1;
  }
  const picks: number[] = [];
  groups.forEach((group, index) => {
    const count = alloc[index];
    if (count <= 0) {
      return;
    }
    const step = group.indexes.length / count;
    for (let pick = 0; pick < count; pick += 1) {
      const at = Math.min(group.indexes.length - 1, Math.floor(pick * step));
      picks.push(group.indexes[at]);
    }
  });
  return picks.slice(0, STARLINK_POINT_CAP);
}
