import may2024 from "@/data/replays/may2024.json";

/**
 * Storm replays the timeline can play. Each one is a data/replays/<id>.json built by ml/build_replay.py; this file
 * adds what the app says about it. Add an event here and in ml/build_replay.py EVENTS.
 */

export interface ReplayHourRow {
  time: string;
  kp: number | null;
  dst: number | null;
  dstLabel?: string;
  gLevel: string | null;
  forecastKpP50: number | null;
  goesProtonFlux?: number | null;
}

export interface AiRow {
  issued: string;
  horizonH: number;
  target: string;
  p10: number;
  p50: number;
  p90: number;
}

export interface FirstWarning {
  kp: number;
  issued: string;
  usableAt: string;
  horizonH: number;
  p90: number;
  firstObservedAt: string;
  leadHours: number;
}

export interface ReplayFile {
  label: string;
  aiForecast: { note: string; rows: AiRow[]; firstWarning: FirstWarning | null };
  window: [string, string];
  markers: Record<string, string[]>;
  hours: ReplayHourRow[];
}

export type EventId = "may2024";

export type MarkerKind = "sep" | "peak" | "flare" | "cme" | "launch" | "loss";

export interface EventMarker {
  time: string;
  kind: MarkerKind;
  label: string;
}

/** Where the AI forecaster's training split puts the event (ml/splits.py): train ≤ 2019, validation 2020–22, test ≥ 2023. */
export type SplitTag = "in-sample" | "validation" | "test";

export interface StormEvent {
  id: EventId;
  /** Button and card title. */
  title: string;
  /** Short name used in sentences: "How it did in May 2024". */
  shortName: string;
  dates: string;
  /** What the event is a stress test for. */
  stresses: ("radiation" | "drag")[];
  /** One or two sentences, facts from the replay data or the cited sources only. */
  story: string;
  split: SplitTag;
  replay: ReplayFile;
  markers: EventMarker[];
  /** Note on how the replay's proton series was made. */
  protonNote: string;
}

function markerList(times: string[] | undefined, kind: MarkerKind, label: string): EventMarker[] {
  return (times ?? []).map((time) => ({ time, kind, label }));
}

const may2024Replay = may2024 as unknown as ReplayFile;

export const EVENTS: readonly StormEvent[] = [
  {
    id: "may2024",
    title: "May 2024 superstorm",
    shortName: "May 2024",
    dates: "5–16 May 2024",
    stresses: ["radiation", "drag"],
    story:
      "Kp reached 9 (G5) on 10–11 May and Dst fell to −406 nT. Protons above 10 MeV peaked near 100 pfu (S2) in this replay's GOES-16 estimate.",
    split: "test",
    replay: may2024Replay,
    markers: [
      ...markerList(may2024Replay.markers.sepOnset, "sep", "SEP onset"),
      ...markerList(may2024Replay.markers.kp9, "peak", "Kp 9"),
    ],
    protonNote:
      "Replay protons are integrated from GOES-16 differential channels (estimate), hourly means stamped at the hour's end.",
  },
];

export const DEFAULT_EVENT_ID: EventId = "may2024";

export function isEventId(value: string): value is EventId {
  return EVENTS.some((event) => event.id === value);
}

export function eventById(id: EventId): StormEvent {
  const event = EVENTS.find((item) => item.id === id);
  if (!event) {
    throw new Error(`unknown event ${id}`);
  }
  return event;
}

/** The replay a timeline mode plays, or null for the live window. */
export function eventForMode(mode: string): StormEvent | null {
  return isEventId(mode) ? eventById(mode) : null;
}

export const SPLIT_TEXT: Record<SplitTag, string> = {
  "in-sample": "in the forecaster's training period",
  validation: "in the forecaster's validation period",
  test: "in the forecaster's test period (never trained or tuned on)",
};

export interface EventStats {
  peakKp: number | null;
  peakProtonPfu: number | null;
  minDst: number | null;
}

/** Headline numbers for an event card, straight from the replay hours. */
export function eventStats(replay: ReplayFile): EventStats {
  let peakKp: number | null = null;
  let peakProtonPfu: number | null = null;
  let minDst: number | null = null;
  for (const hour of replay.hours) {
    if (hour.kp !== null) {
      peakKp = Math.max(peakKp ?? -Infinity, hour.kp);
    }
    if (hour.goesProtonFlux != null) {
      peakProtonPfu = Math.max(peakProtonPfu ?? -Infinity, hour.goesProtonFlux);
    }
    if (hour.dst !== null) {
      minDst = Math.min(minDst ?? Infinity, hour.dst);
    }
  }
  return { peakKp, peakProtonPfu, minDst };
}

export interface StormCallStats {
  /** 3-hour blocks with observed Kp ≥ 7 (G3+) that have a +3 h forecast. */
  blocks: number;
  medianBelowAll: boolean;
  p90Reached: number;
  /** The first G3+ block was not reached by the P90 edge. */
  missedFirst: boolean;
}

/** How the +3 h forecast did in the event's G3+ blocks. */
export function stormCallStats(replay: ReplayFile, kpThreshold = 7): StormCallStats {
  const byTarget = new Map(replay.aiForecast.rows.filter((row) => row.horizonH === 3).map((row) => [row.target, row]));
  const hits: { observed: number; row: AiRow }[] = [];
  for (const hour of replay.hours) {
    const row = byTarget.get(hour.time);
    if (row && hour.kp !== null && hour.kp >= kpThreshold) {
      hits.push({ observed: hour.kp, row });
    }
  }
  return {
    blocks: hits.length,
    medianBelowAll: hits.length > 0 && hits.every((hit) => hit.row.p50 < hit.observed),
    p90Reached: hits.filter((hit) => hit.row.p90 >= hit.observed).length,
    missedFirst: hits.length > 0 && hits[0].row.p90 < hits[0].observed,
  };
}
