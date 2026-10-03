import table from "@/data/orbit/density_table.json";

export interface Activity {
  f107: number;
  ap: number;
}

interface AxisHit {
  i0: number;
  i1: number;
  t: number;
}

function axisHit(axis: number[], value: number): AxisHit {
  if (value <= axis[0]) {
    return { i0: 0, i1: 0, t: 0 };
  }
  const last = axis.length - 1;
  if (value >= axis[last]) {
    return { i0: last, i1: last, t: 0 };
  }
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (axis[mid] <= value) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const span = axis[hi] - axis[lo];
  const t = span === 0 ? 0 : (value - axis[lo]) / span;
  if (t === 0) {
    return { i0: lo, i1: lo, t: 0 };
  }
  if (t >= 1) {
    return { i0: hi, i1: hi, t: 0 };
  }
  return { i0: lo, i1: hi, t };
}

function lerp(a: number, b: number, t: number): number {
  if (t === 0) {
    return a;
  }
  return a * (1 - t) + b * t;
}

/** Trilinear sample of the precomputed NRLMSIS 2.0 table. Nodes are returned unchanged. */
export function densityKgM3(altitudeKm: number, activity: Activity): number {
  const alt = axisHit(table.altitudesKm, altitudeKm);
  const f107 = axisHit(table.f107, activity.f107);
  const ap = axisHit(table.ap, activity.ap);
  const sample = (ia: number, iff: number, ip: number) => table.density[ia][iff][ip];
  const c000 = sample(alt.i0, f107.i0, ap.i0);
  const c100 = sample(alt.i1, f107.i0, ap.i0);
  const c010 = sample(alt.i0, f107.i1, ap.i0);
  const c110 = sample(alt.i1, f107.i1, ap.i0);
  const c001 = sample(alt.i0, f107.i0, ap.i1);
  const c101 = sample(alt.i1, f107.i0, ap.i1);
  const c011 = sample(alt.i0, f107.i1, ap.i1);
  const c111 = sample(alt.i1, f107.i1, ap.i1);
  const c00 = lerp(c000, c100, alt.t);
  const c10 = lerp(c010, c110, alt.t);
  const c01 = lerp(c001, c101, alt.t);
  const c11 = lerp(c011, c111, alt.t);
  return lerp(lerp(c00, c10, f107.t), lerp(c01, c11, f107.t), ap.t);
}

export const DENSITY_TABLE = table;
