/** Live feature tensor. Same definitions as ml/features.py. */

export type HourlyColumns = {
  times: string[];
  bz_gsm: Array<number | null>;
  by_gsm: Array<number | null>;
  speed: Array<number | null>;
  density: Array<number | null>;
  pdyn: Array<number | null>;
  kp: Array<number | null>;
  dst: Array<number | null>;
  f107: Array<number | null>;
};

const HOUR_MS = 60 * 60 * 1000;
const SOLAR = ["bz_gsm", "by_gsm", "speed", "density", "pdyn"] as const;
const SOLAR_WINDOWS = [3, 6, 12, 24] as const;

export function ffillLimit3(values: Array<number | null>): Array<number | null> {
  const out: Array<number | null> = new Array(values.length);
  let last: number | null = null;
  let filled = 0;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value !== null && Number.isFinite(value)) {
      last = value;
      filled = 0;
      out[i] = value;
    } else if (last !== null && filled < 3) {
      filled += 1;
      out[i] = last;
    } else {
      out[i] = null;
      if (last !== null) {
        filled += 1;
      }
    }
  }
  return out;
}

export function rollingMean(values: Array<number | null>, window: number): Array<number | null> {
  const out: Array<number | null> = new Array(values.length);
  for (let i = 0; i < values.length; i += 1) {
    const start = Math.max(0, i - window + 1);
    let sum = 0;
    let count = 0;
    for (let j = start; j <= i; j += 1) {
      const value = values[j];
      if (value !== null && Number.isFinite(value)) {
        sum += value;
        count += 1;
      }
    }
    out[i] = count >= 1 ? sum / count : null;
  }
  return out;
}

export function rollingMin(values: Array<number | null>, window: number): Array<number | null> {
  const out: Array<number | null> = new Array(values.length);
  for (let i = 0; i < values.length; i += 1) {
    const start = Math.max(0, i - window + 1);
    let min: number | null = null;
    for (let j = start; j <= i; j += 1) {
      const value = values[j];
      if (value !== null && Number.isFinite(value) && (min === null || value < min)) {
        min = value;
      }
    }
    out[i] = min;
  }
  return out;
}

function shift(values: Array<number | null>, lag: number): Array<number | null> {
  return values.map((_, index) => (index >= lag ? values[index - lag] : null));
}

function at(values: Array<number | null>, index: number): number | null {
  if (index < 0 || index >= values.length) {
    return null;
  }
  const value = values[index];
  return value !== null && Number.isFinite(value) ? value : null;
}

export function floorHour(ms: number): number {
  return Math.floor(ms / HOUR_MS) * HOUR_MS;
}

export function floor3h(ms: number): number {
  return Math.floor(ms / (3 * HOUR_MS)) * (3 * HOUR_MS);
}

export function computeFeatureMap(hourly: HourlyColumns, issueTime: string): Record<string, number | null> {
  const times = hourly.times.map((value) => Date.parse(value));
  const issue = Date.parse(issueTime);
  const issueIndex = times.indexOf(issue);
  if (issueIndex < 0) {
    throw new Error("issue hour is not in the hourly table");
  }
  const map: Record<string, number | null> = {};
  const boundary = floor3h(issue);
  for (const blocks of [0, 1, 2, 4, 8]) {
    const src = boundary - (1 + 3 * blocks) * HOUR_MS;
    const srcIndex = times.indexOf(src);
    map[`kp_block_lag${blocks}`] = at(hourly.kp, srcIndex);
  }
  for (const lag of [0, 1, 3, 6, 12, 24]) {
    map[`dst_lag${lag}`] = at(hourly.dst, issueIndex - lag);
  }
  const f107 = shift(hourly.f107, 24);
  map.f107_lag24 = at(f107, issueIndex);

  const filled: Record<(typeof SOLAR)[number], Array<number | null>> = {
    bz_gsm: [],
    by_gsm: [],
    speed: [],
    density: [],
    pdyn: [],
  };
  for (const column of SOLAR) {
    const raw = hourly[column];
    map[`${column}_missing`] = at(raw, issueIndex) === null ? 1 : 0;
    filled[column] = ffillLimit3(raw);
    map[column] = at(filled[column], issueIndex);
    for (const window of SOLAR_WINDOWS) {
      map[`${column}_mean${window}`] = at(rollingMean(filled[column], window), issueIndex);
    }
  }
  map.bz_gsm_min3 = at(rollingMin(filled.bz_gsm, 3), issueIndex);
  map.bz_gsm_min6 = at(rollingMin(filled.bz_gsm, 6), issueIndex);
  map.kp_block_missing = map.kp_block_lag0 === null ? 1 : 0;
  map.dst_missing = at(hourly.dst, issueIndex) === null ? 1 : 0;
  map.f107_lag24_missing = map.f107_lag24 === null ? 1 : 0;
  const bzMissing = hourly.bz_gsm.map((value) => (value === null || !Number.isFinite(value) ? 1 : 0));
  map.bz_gsm_missing_mean24 = at(rollingMean(bzMissing, 24), issueIndex);
  return map;
}

export function vectorFromMap(names: readonly string[], map: Record<string, number | null>): Float32Array {
  const out = new Float32Array(names.length);
  for (let i = 0; i < names.length; i += 1) {
    const value = map[names[i]];
    out[i] = value == null || !Number.isFinite(value) ? Number.NaN : value;
  }
  return out;
}

type Timed = { time_tag: string };

function mean(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Live dynamic pressure, nPa. RTSW has no alpha ratio, so this is the OMNI 2.0e-6 branch. */
export function livePdyn(density: number, speed: number): number {
  return (2.0 / 1e6) * density * speed * speed;
}

export function buildHourlyFromFeeds(
  issue: Date,
  mag: Array<Timed & { bz_gsm: number | null; by_gsm: number | null }>,
  wind: Array<Timed & { proton_speed: number; proton_density: number }>,
  kp: Array<Timed & { Kp: number }>,
  dst: Array<Timed & { dst: number }>,
  f107: Array<Timed & { flux: number; reporting_schedule: string }>,
): HourlyColumns {
  const issueMs = floor3h(issue.getTime());
  const start = issueMs - 96 * HOUR_MS;
  const times: string[] = [];
  const count = 97;
  const bz: Array<number[]> = Array.from({ length: count }, () => []);
  const by: Array<number[]> = Array.from({ length: count }, () => []);
  const speed: Array<number[]> = Array.from({ length: count }, () => []);
  const density: Array<number[]> = Array.from({ length: count }, () => []);
  const kpValues: Array<number | null> = Array.from({ length: count }, () => null);
  const dstValues: Array<number | null> = Array.from({ length: count }, () => null);
  const f107Values: Array<number | null> = Array.from({ length: count }, () => null);
  for (let i = 0; i < count; i += 1) {
    times.push(new Date(start + i * HOUR_MS).toISOString());
  }
  const indexOf = (ms: number) => Math.round((floorHour(ms) - start) / HOUR_MS);

  for (const row of mag) {
    const ms = Date.parse(row.time_tag);
    const index = indexOf(ms);
    if (index < 0 || index >= count) {
      continue;
    }
    if (row.bz_gsm !== null && Number.isFinite(row.bz_gsm)) {
      bz[index].push(row.bz_gsm);
    }
    if (row.by_gsm !== null && Number.isFinite(row.by_gsm)) {
      by[index].push(row.by_gsm);
    }
  }
  for (const row of wind) {
    const ms = Date.parse(row.time_tag);
    const index = indexOf(ms);
    if (index < 0 || index >= count) {
      continue;
    }
    if (Number.isFinite(row.proton_speed)) {
      speed[index].push(row.proton_speed);
    }
    if (Number.isFinite(row.proton_density)) {
      density[index].push(row.proton_density);
    }
  }
  for (const row of kp) {
    const blockStart = Date.parse(row.time_tag);
    if (!Number.isFinite(blockStart) || blockStart + 3 * HOUR_MS > issueMs) {
      continue;
    }
    for (const offset of [0, 1, 2]) {
      const index = indexOf(blockStart + offset * HOUR_MS);
      if (index >= 0 && index < count && Number.isFinite(row.Kp)) {
        kpValues[index] = row.Kp;
      }
    }
  }
  for (const row of dst) {
    const index = indexOf(Date.parse(row.time_tag));
    if (index >= 0 && index < count && Number.isFinite(row.dst)) {
      dstValues[index] = row.dst;
    }
  }
  const byDate = new Map<string, { flux: number; noon: boolean }>();
  for (const row of f107) {
    const ms = Date.parse(row.time_tag);
    if (!Number.isFinite(ms) || !Number.isFinite(row.flux)) {
      continue;
    }
    const day = new Date(ms).toISOString().slice(0, 10);
    const noon = row.reporting_schedule.toLowerCase() === "noon";
    const current = byDate.get(day);
    if (!current || noon || !current.noon) {
      byDate.set(day, { flux: row.flux, noon: noon || current?.noon === true });
    }
  }
  for (let i = 0; i < count; i += 1) {
    const day = times[i].slice(0, 10);
    const row = byDate.get(day);
    if (row) {
      f107Values[i] = row.flux;
    }
  }
  return {
    times,
    bz_gsm: bz.map((values) => mean(values)),
    by_gsm: by.map((values) => mean(values)),
    speed: speed.map((values) => mean(values)),
    density: density.map((values) => mean(values)),
    pdyn: speed.map((speedValues, index) => {
      const v = mean(speedValues);
      const n = mean(density[index]);
      return v === null || n === null ? null : livePdyn(n, v);
    }),
    kp: kpValues,
    dst: dstValues,
    f107: f107Values,
  };
}

export function issueTimeIso(now: Date): string {
  return new Date(floor3h(now.getTime())).toISOString();
}
