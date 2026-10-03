import type { SourceLabel } from "@/lib/types";

export interface RangeValue {
  low: number;
  mid: number;
  high: number;
  unit: string;
  label: SourceLabel;
  assumptions: string[];
  sourceUrl?: string;
}

export function rangeValue(value: RangeValue): RangeValue {
  if (!(value.low <= value.mid && value.mid <= value.high)) {
    throw new Error(`range out of order: ${value.low} ${value.mid} ${value.high}`);
  }
  return value;
}

export function meanMinMax(samples: number[]): { low: number; mid: number; high: number } {
  if (samples.length === 0) {
    return { low: 0, mid: 0, high: 0 };
  }
  let low = samples[0];
  let high = samples[0];
  let sum = 0;
  for (const sample of samples) {
    low = Math.min(low, sample);
    high = Math.max(high, sample);
    sum += sample;
  }
  const mean = sum / samples.length;
  return { low, mid: Math.min(high, Math.max(low, mean)), high };
}
