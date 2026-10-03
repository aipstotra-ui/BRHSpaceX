/** Quantile postprocess shared by the panel and the unit tests. */

export type TargetName = "kp" | "dst";

export type QuantileTriple = {
  p10: number;
  p50: number;
  p90: number;
};

const KP_MIN = 0;
const KP_MAX = 9;

function clipKp(value: number): number {
  return Math.min(KP_MAX, Math.max(KP_MIN, value));
}

export function sortQuantiles(p10: number, p50: number, p90: number): QuantileTriple {
  const ordered = [p10, p50, p90].sort((left, right) => left - right);
  return { p10: ordered[0], p50: ordered[1], p90: ordered[2] };
}

/**
 * Match ml/forecast_common.py apply_interval, then sort for display.
 * The unsorted 0.5 model output is what the test MAE uses.
 */
export function calibrateQuantiles(
  target: TargetName,
  p10: number,
  p50: number,
  p90: number,
  delta: number,
): QuantileTriple {
  let low = p10;
  let mid = p50;
  let high = p90;
  if (target === "kp") {
    low = clipKp(low);
    mid = clipKp(mid);
    high = clipKp(high);
  }
  let lo = Math.min(low, high) - delta;
  let hi = Math.max(low, high) + delta;
  if (target === "kp") {
    lo = clipKp(lo);
    hi = clipKp(hi);
  }
  if (lo > hi) {
    const swap = lo;
    lo = hi;
    hi = swap;
  }
  return sortQuantiles(lo, mid, hi);
}
