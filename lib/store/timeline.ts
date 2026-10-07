import { create } from "zustand";

export type TimelineMode = "now" | "may2024";

/** Where a timeline value came from. Forecast values are the AI forecast P50, never observations. */
export type PointKind = "observed" | "forecast" | "replay";

export interface TimelinePoint {
  timeMs: number;
  kp: number | null;
  kpP10?: number | null;
  kpP90?: number | null;
  /** GOES integral proton flux above 10 MeV, pfu. */
  protonPfu: number | null;
  kind: PointKind;
}

export interface ForecastKp {
  horizonH: number;
  p10: number;
  p50: number;
  p90: number;
}

interface TimelineState {
  mode: TimelineMode;
  /** Reference "now": wall clock (or the snapshot's latest observation) in "now" mode, the replay start otherwise. */
  anchorMs: number;
  points: TimelinePoint[];
  /** The point whose block contains simTimeMs. Changes only when the clock crosses into another block. */
  index: number;
  /** Absolute simulation time, UTC ms. Moves continuously while the clock plays. */
  simTimeMs: number;
  forecastIssueIso: string | null;
  forecastKp: ForecastKp[];
  setMode: (mode: TimelineMode) => void;
  setPoints: (points: TimelinePoint[], index: number, anchorMs: number) => void;
  /** Jump to the start of a point's block. */
  setIndex: (index: number) => void;
  setSimTime: (timeMs: number) => void;
  setForecast: (issueIso: string, rows: ForecastKp[]) => void;
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  mode: "now",
  anchorMs: 0,
  points: [],
  index: 0,
  simTimeMs: 0,
  forecastIssueIso: null,
  forecastKp: [],
  setMode: (mode) => set({ mode, points: [], index: 0 }),
  setPoints: (points, index, anchorMs) => {
    const at = clamp(index, points.length);
    set({ points, index: at, anchorMs, simTimeMs: points[at]?.timeMs ?? anchorMs });
  },
  setIndex: (index) => {
    const { points } = get();
    const at = clamp(index, points.length);
    set({ index: at, simTimeMs: points[at]?.timeMs ?? get().simTimeMs });
  },
  setSimTime: (timeMs) => {
    const { points, index, simTimeMs } = get();
    const range = timelineRange(points);
    const clamped = range ? Math.min(range.endMs, Math.max(range.startMs, timeMs)) : timeMs;
    if (clamped === simTimeMs) {
      return;
    }
    const next = indexAt(points, clamped);
    set(next === index ? { simTimeMs: clamped } : { simTimeMs: clamped, index: next });
  },
  setForecast: (forecastIssueIso, forecastKp) => set({ forecastIssueIso, forecastKp }),
}));

function clamp(index: number, length: number): number {
  return Math.max(0, Math.min(length - 1, Math.round(index)));
}

/** First to last point time. Null when there are no points. */
export function timelineRange(points: TimelinePoint[]): { startMs: number; endMs: number } | null {
  if (points.length === 0) {
    return null;
  }
  return { startMs: points[0].timeMs, endMs: points[points.length - 1].timeMs };
}

/** Index of the last point at or before the time (0 before the first point). Points are sorted by time. */
export function indexAt(points: TimelinePoint[], timeMs: number): number {
  let low = 0;
  let high = points.length - 1;
  if (high < 0 || timeMs < points[0].timeMs) {
    return 0;
  }
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (points[mid].timeMs <= timeMs) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

const HOUR_MS = 3_600_000;
/** estimate: a feed whose newest Kp block is older than this is a stale snapshot. */
export const STALE_AFTER_HOURS = 6;

/**
 * Reference "now" for the live window. A fresh feed uses the wall clock. A stale snapshot uses the end of its newest
 * 3-hour Kp block, so the window shows the last saved day instead of nothing.
 */
export function liveReferenceMs(kpTimesMs: number[], wallMs: number): { referenceMs: number; stale: boolean } {
  const newest = kpTimesMs.filter((at) => at <= wallMs).reduce((best, at) => Math.max(best, at), -Infinity);
  if (!Number.isFinite(newest) || wallMs - newest <= STALE_AFTER_HOURS * HOUR_MS) {
    return { referenceMs: wallMs, stale: false };
  }
  return { referenceMs: newest + 3 * HOUR_MS, stale: true };
}

export interface TimelineSample {
  /** Kp holds for the whole block it was reported for. */
  kp: number | null;
  /** Proton flux interpolates linearly between neighbouring points (log interpolation would overstate the dips). */
  protonPfu: number | null;
}

/** Space weather at an arbitrary time inside the timeline. */
export function sampleAt(points: TimelinePoint[], timeMs: number): TimelineSample {
  if (points.length === 0) {
    return { kp: null, protonPfu: null };
  }
  const i = indexAt(points, timeMs);
  const here = points[i];
  const next = points[i + 1];
  let protonPfu = here.protonPfu;
  if (next && here.protonPfu !== null && next.protonPfu !== null && timeMs > here.timeMs) {
    const f = Math.min(1, (timeMs - here.timeMs) / (next.timeMs - here.timeMs));
    protonPfu = here.protonPfu + (next.protonPfu - here.protonPfu) * f;
  }
  return { kp: here.kp, protonPfu };
}

export interface TimelineCursor {
  mode: TimelineMode;
  point: TimelinePoint | null;
  /** Seconds from the anchor to the current block's start. */
  offsetS: number;
}

/** The current block. Re-renders only when the clock crosses into another block, not every frame. */
export function useTimelineCursor(): TimelineCursor {
  const mode = useTimelineStore((state) => state.mode);
  const point = useTimelineStore((state) => state.points[state.index] ?? null);
  const anchorMs = useTimelineStore((state) => state.anchorMs);
  return { mode, point, offsetS: point ? (point.timeMs - anchorMs) / 1000 : 0 };
}
