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
  /** Wall-clock reference for "now" mode; replay offsets are from the replay start. */
  anchorMs: number;
  points: TimelinePoint[];
  index: number;
  forecastIssueIso: string | null;
  forecastKp: ForecastKp[];
  setMode: (mode: TimelineMode) => void;
  setPoints: (points: TimelinePoint[], index: number, anchorMs: number) => void;
  setIndex: (index: number) => void;
  setForecast: (issueIso: string, rows: ForecastKp[]) => void;
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  mode: "now",
  anchorMs: 0,
  points: [],
  index: 0,
  forecastIssueIso: null,
  forecastKp: [],
  setMode: (mode) => set({ mode, points: [], index: 0 }),
  setPoints: (points, index, anchorMs) => set({ points, index: clamp(index, points.length), anchorMs }),
  setIndex: (index) => set({ index: clamp(index, get().points.length) }),
  setForecast: (forecastIssueIso, forecastKp) => set({ forecastIssueIso, forecastKp }),
}));

function clamp(index: number, length: number): number {
  return Math.max(0, Math.min(length - 1, Math.round(index)));
}

export interface TimelineCursor {
  mode: TimelineMode;
  point: TimelinePoint | null;
  /** Seconds from the anchor. Drives Starmind's position on the globe. */
  offsetS: number;
}

export function useTimelineCursor(): TimelineCursor {
  const mode = useTimelineStore((state) => state.mode);
  const point = useTimelineStore((state) => state.points[state.index] ?? null);
  const anchorMs = useTimelineStore((state) => state.anchorMs);
  return { mode, point, offsetS: point ? (point.timeMs - anchorMs) / 1000 : 0 };
}
