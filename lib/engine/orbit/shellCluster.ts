import { MU_M3_S2, RE_M, SHELL_GAP_KM, SHELL_MIN_BIN_COUNT } from "@/lib/engine/orbit/constants";

export interface ShellRecord {
  inclinationDeg: number;
  meanMotionRevPerDay: number;
}

export interface ShellCluster {
  count: number;
  meanAltitudeKm: number;
  meanInclinationDeg: number;
  inclinationBinDeg: number;
  altitudeMinKm: number;
  altitudeMaxKm: number;
}

export function altitudeKmFromMeanMotion(meanMotionRevPerDay: number): number {
  const n = (meanMotionRevPerDay * 2 * Math.PI) / 86400;
  const semiMajor = Math.cbrt(MU_M3_S2 / (n * n));
  return (semiMajor - RE_M) / 1000;
}

/**
 * Largest shell in a GP snapshot.
 * Grouping rules are estimates: inclination rounded to 0.1°, 1 km floor bins,
 * bins under 20 objects dropped, and a split when dense bins are more than 3 km apart.
 */
export function largestShell(records: ShellRecord[]): ShellCluster {
  const bins = new Map<string, { incBin: number; altBin: number; n: number; sumAlt: number; sumInc: number }>();
  for (const record of records) {
    if (!Number.isFinite(record.inclinationDeg) || !Number.isFinite(record.meanMotionRevPerDay)) {
      continue;
    }
    if (!(record.meanMotionRevPerDay > 0)) {
      continue;
    }
    const altitude = altitudeKmFromMeanMotion(record.meanMotionRevPerDay);
    const incBin = Math.round(record.inclinationDeg * 10) / 10;
    const altBin = Math.floor(altitude);
    const key = `${incBin}:${altBin}`;
    const bin = bins.get(key) ?? { incBin, altBin, n: 0, sumAlt: 0, sumInc: 0 };
    bin.n += 1;
    bin.sumAlt += altitude;
    bin.sumInc += record.inclinationDeg;
    bins.set(key, bin);
  }

  const byInclination = new Map<number, { altBin: number; n: number; sumAlt: number; sumInc: number }[]>();
  for (const bin of bins.values()) {
    if (bin.n < SHELL_MIN_BIN_COUNT) {
      continue;
    }
    const rows = byInclination.get(bin.incBin) ?? [];
    rows.push(bin);
    byInclination.set(bin.incBin, rows);
  }

  let best: ShellCluster | null = null;
  for (const [incBin, rows] of byInclination) {
    rows.sort((a, b) => a.altBin - b.altBin);
    let current: typeof rows = [];
    let previous: number | null = null;
    const flush = () => {
      if (current.length === 0) {
        return;
      }
      const count = current.reduce((sum, row) => sum + row.n, 0);
      const sumAlt = current.reduce((sum, row) => sum + row.sumAlt, 0);
      const sumInc = current.reduce((sum, row) => sum + row.sumInc, 0);
      const cluster: ShellCluster = {
        count,
        meanAltitudeKm: sumAlt / count,
        meanInclinationDeg: sumInc / count,
        inclinationBinDeg: incBin,
        altitudeMinKm: current[0].altBin,
        altitudeMaxKm: current[current.length - 1].altBin,
      };
      if (!best || cluster.count > best.count) {
        best = cluster;
      }
      current = [];
    };
    for (const row of rows) {
      if (previous !== null && row.altBin - previous > SHELL_GAP_KM) {
        flush();
      }
      current.push(row);
      previous = row.altBin;
    }
    flush();
  }

  if (!best) {
    throw new Error("no shell in the snapshot");
  }
  return best;
}
