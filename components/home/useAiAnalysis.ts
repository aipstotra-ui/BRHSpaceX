"use client";

import { useEffect, useMemo, useState } from "react";

import may2024 from "@/data/replays/may2024.json";
import { useImpactStore } from "@/components/home/impactStore";
import { decide, policyVector, type PolicyContext, type PolicyDecision } from "@/lib/ml/policyInput";
import { runPolicyProbabilities } from "@/lib/ml/policy";
import { useShellStore } from "@/lib/store";
import { exposureWeight } from "@/lib/engine/replayOnOrbit";
import { useOrbitStore } from "@/lib/store/orbit";
import { useTimelineCursor, useTimelineStore } from "@/lib/store/timeline";

export interface AiRow {
  issued: string;
  horizonH: number;
  target: string;
  p10: number;
  p50: number;
  p90: number;
}

/** Largest per-orbit exposure ("saa") in the policy's training table, ml/build_oracle.py ORBITS. */
export const POLICY_SAA_MAX = 0.22;

export const AI_REPLAY = may2024.aiForecast as {
  note: string;
  rows: AiRow[];
  firstWarning: {
    kp: number;
    issued: string;
    usableAt: string;
    horizonH: number;
    p90: number;
    firstObservedAt: string;
    leadHours: number;
  } | null;
};

/** Latest replay forecast issue at or before a time, all horizons. */
export function replayIssueAt(timeMs: number): AiRow[] {
  let issued: string | null = null;
  for (const row of AI_REPLAY.rows) {
    if (Date.parse(row.issued) <= timeMs && (issued === null || row.issued > issued)) {
      issued = row.issued;
    }
  }
  return issued === null ? [] : AI_REPLAY.rows.filter((row) => row.issued === issued);
}

const HOUR_MS = 3_600_000;
const HOURS_BY_TIME = new Map(may2024.hours.map((hour) => [Date.parse(hour.time), hour]));

/**
 * What was actually published by replay hour t, so the policy never sees the future:
 * - Kp of the last completed 3-hour block (stored on hour floor3(t) - 1, as in ml/features.py),
 * - Dst of hour t - 1 (an OMNI hour row covers t to t+59 min),
 * - the AI forecast issue whose inputs were complete by t (issue time + 1 h <= t).
 */
export function replayInputsAt(timeMs: number): {
  kp: number | null;
  dst: number | null;
  issue: AiRow[];
} {
  const date = new Date(timeMs);
  const blockStart = timeMs - (date.getUTCHours() % 3) * HOUR_MS - date.getUTCMinutes() * 60_000;
  const lastBlock = HOURS_BY_TIME.get(blockStart - HOUR_MS);
  const previousHour = HOURS_BY_TIME.get(timeMs - HOUR_MS);
  return {
    kp: lastBlock?.kp ?? null,
    dst: previousHour?.dst ?? null,
    issue: replayIssueAt(timeMs - HOUR_MS),
  };
}

/** The +3 h forecast for the 3-hour block that ends at this hour + 1 h (issued at the block start). */
export function replayForecastFor(timeIso: string): AiRow | null {
  return AI_REPLAY.rows.find((row) => row.horizonH === 3 && row.target === timeIso) ?? null;
}

export interface AiOutlook {
  issuedIso: string | null;
  /** Highest P50 and P90 Kp over the issue's horizons (+3 to +24 h). */
  peakP50: number;
  peakP90: number;
  peakHorizonH: number;
  shortBand: { p10: number; p50: number; p90: number } | null;
}

export interface AiAnalysis {
  outlook: AiOutlook | null;
  decision: PolicyDecision | null;
  phase: "loading" | "ready" | "error" | "empty";
  chipExact: boolean;
  /** The exposure input is above the 0.05–0.22 range the policy was trained on. */
  outsideTraining: boolean;
}

function summarize(rows: { horizonH: number; p10: number; p50: number; p90: number }[], issuedIso: string | null): AiOutlook | null {
  if (rows.length === 0) {
    return null;
  }
  let peak = rows[0];
  for (const row of rows) {
    if (row.p90 > peak.p90) {
      peak = row;
    }
  }
  const short = rows.find((row) => row.horizonH === 3) ?? null;
  return {
    issuedIso,
    peakP50: Math.max(...rows.map((row) => row.p50)),
    peakP90: peak.p90,
    peakHorizonH: peak.horizonH,
    shortBand: short ? { p10: short.p10, p50: short.p50, p90: short.p90 } : null,
  };
}

export function useAiAnalysis(): AiAnalysis {
  const cursor = useTimelineCursor();
  const forecastKp = useTimelineStore((state) => state.forecastKp);
  const forecastIssueIso = useTimelineStore((state) => state.forecastIssueIso);
  const result = useImpactStore((state) => state.result);
  const presetId = useShellStore((state) => state.presetId);
  const altitudeKm = useOrbitStore((state) => state.altitudeKm);
  const inclinationDeg = useOrbitStore((state) => state.inclinationDeg);
  const [liveDst, setLiveDst] = useState<number | null>(null);
  const [decision, setDecision] = useState<PolicyDecision | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/data/dst", { cache: "no-store" })
      .then((response) => response.json())
      .then((body: { data?: { dst: number }[] }) => {
        const last = body.data?.[body.data.length - 1];
        if (!cancelled && last && Number.isFinite(last.dst)) {
          setLiveDst(last.dst);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const replay = cursor.mode === "may2024";
  const timeMs = cursor.point?.timeMs ?? null;
  const outlook = useMemo(() => {
    if (replay) {
      if (timeMs === null) {
        return null;
      }
      const rows = replayInputsAt(timeMs).issue;
      return summarize(rows, rows[0]?.issued ?? null);
    }
    return summarize(
      forecastKp.map((row) => ({ horizonH: row.horizonH, p10: row.p10, p50: row.p50, p90: row.p90 })),
      forecastIssueIso,
    );
  }, [replay, timeMs, forecastKp, forecastIssueIso]);

  const replayKnown = useMemo(() => (replay && timeMs !== null ? replayInputsAt(timeMs) : null), [replay, timeMs]);

  const context: PolicyContext | null = useMemo(() => {
    // Live "observed" points are completed Kp blocks already; replay hours need the published values.
    const kp = replay ? replayKnown?.kp : cursor.point?.kp;
    const pfu = cursor.point?.protonPfu ?? null;
    const dst = replay ? (replayKnown?.dst ?? null) : liveDst;
    if (kp == null || dst == null || !outlook?.shortBand || !result) {
      return null;
    }
    return {
      kp,
      forecast: outlook.shortBand,
      dst,
      saa: exposureWeight({ altitudeKm, inclinationDeg }, kp, pfu),
      auroral: result.auroralFraction.mid,
      eclipse: result.eclipseFraction.mid,
      presetId,
    };
  }, [cursor.point?.kp, cursor.point?.protonPfu, replay, replayKnown, liveDst, outlook, result, presetId, altitudeKm, inclinationDeg]);

  const key = context ? JSON.stringify(context) : "";
  useEffect(() => {
    if (!context) {
      return;
    }
    let cancelled = false;
    runPolicyProbabilities(policyVector(context))
      .then((probabilities) => {
        if (!cancelled) {
          setDecision(decide(probabilities, context));
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
    // The key captures every field of the context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return {
    outlook,
    decision: context ? decision : null,
    phase: failed ? "error" : !context ? (outlook ? "loading" : "empty") : decision ? "ready" : "loading",
    chipExact: presetId === "ai1-spacex" || presetId === "h100-starcloud" || presetId === "orin-agx",
    outsideTraining: (context?.saa ?? 0) > POLICY_SAA_MAX,
  };
}
