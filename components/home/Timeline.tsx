"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import may2024 from "@/data/replays/may2024.json";
import { AI_REPLAY } from "@/components/home/useAiAnalysis";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { StatusBadge, type Status } from "@/components/ui/StatusBadge";
import { gscale } from "@/lib/engine/gscale";
import { auroralBoundaryMlatDeg, sepActive, sepCutoffMlatDeg, sscale } from "@/lib/engine/orbit/stormZones";
import { useTimelineStore, type TimelineMode, type TimelinePoint } from "@/lib/store/timeline";

type KpRow = { time_tag: string; Kp: number };
type ProtonRow = { time_tag: string; flux: number; energy: string };
type ReplayHour = { time: string; kp: number | null; goesProtonFlux: number | null };

const HOUR_MS = 3_600_000;
/** estimate: how far back "now" mode shows observed Kp. */
const HISTORY_HOURS = 24;
/** estimate: playback speed, timeline steps per second. */
const PLAY_STEPS_PER_S = 6;

async function readFeed<T>(id: string): Promise<T | null> {
  try {
    const response = await fetch(`/api/data/${id}`, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { data?: T };
    return body.data ?? null;
  } catch {
    return null;
  }
}

function utc(iso: string): number {
  return Date.parse(iso.endsWith("Z") ? iso : `${iso}Z`);
}

/** Latest >=10 MeV flux at or before each time. */
function protonAt(rows: ProtonRow[], timeMs: number): number | null {
  let best: number | null = null;
  let bestTime = -Infinity;
  for (const row of rows) {
    const at = utc(row.time_tag);
    if (at <= timeMs && at > bestTime && Number.isFinite(row.flux)) {
      best = row.flux;
      bestTime = at;
    }
  }
  return timeMs - bestTime <= 3 * HOUR_MS ? best : null;
}

function replayPoints(): TimelinePoint[] {
  return (may2024.hours as ReplayHour[]).map((hour) => ({
    timeMs: utc(hour.time),
    kp: hour.kp,
    protonPfu: hour.goesProtonFlux,
    kind: "replay" as const,
  }));
}

function gStatus(level: string): Status {
  const n = Number(level.slice(1));
  return n >= 3 ? "critical" : n >= 1 ? "caution" : "nominal";
}

function kpColor(kp: number | null): string {
  if (kp === null) {
    return "var(--line)";
  }
  const status = gStatus(gscale(kp));
  return status === "critical"
    ? "var(--status-critical)"
    : status === "caution"
      ? "var(--status-caution)"
      : "var(--thermal-2)";
}

function formatUtc(timeMs: number): string {
  return new Date(timeMs).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export function Timeline() {
  const mode = useTimelineStore((state) => state.mode);
  const points = useTimelineStore((state) => state.points);
  const index = useTimelineStore((state) => state.index);
  const forecastKp = useTimelineStore((state) => state.forecastKp);
  const forecastIssueIso = useTimelineStore((state) => state.forecastIssueIso);
  const setMode = useTimelineStore((state) => state.setMode);
  const setPoints = useTimelineStore((state) => state.setPoints);
  const setIndex = useTimelineStore((state) => state.setIndex);
  const [phase, setPhase] = useState<"loading" | "ready" | "error" | "empty">("loading");
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (mode === "may2024") {
      const next = replayPoints();
      setPoints(next, 0, next[0]?.timeMs ?? 0);
      window.setTimeout(() => setPhase(next.length ? "ready" : "empty"), 0);
      return;
    }
    window.setTimeout(() => setPhase("loading"), 0);
    void Promise.all([readFeed<KpRow[]>("kp"), readFeed<ProtonRow[]>("goes_protons")]).then(([kpRows, protonRows]) => {
      if (cancelled) {
        return;
      }
      if (!kpRows) {
        setPhase("error");
        return;
      }
      const now = Date.now();
      const protons = (protonRows ?? []).filter((row) => row.energy === ">=10 MeV");
      const observed: TimelinePoint[] = kpRows
        .map((row) => ({ timeMs: utc(row.time_tag), kp: row.Kp }))
        .filter((row) => row.timeMs >= now - HISTORY_HOURS * HOUR_MS && row.timeMs <= now)
        .map((row) => ({ ...row, protonPfu: protonAt(protons, row.timeMs + 3 * HOUR_MS - 1), kind: "observed" as const }));
      const issueMs = forecastIssueIso ? Date.parse(forecastIssueIso) : now;
      const latestProton = protons.length ? protonAt(protons, now) : null;
      const ahead: TimelinePoint[] = forecastKp
        .slice()
        .sort((left, right) => left.horizonH - right.horizonH)
        .map((row) => ({
          timeMs: issueMs + row.horizonH * HOUR_MS,
          kp: row.p50,
          kpP10: row.p10,
          kpP90: row.p90,
          protonPfu: latestProton,
          kind: "forecast" as const,
        }));
      const next = [...observed, ...ahead];
      setPoints(next, Math.max(0, observed.length - 1), now);
      setPhase(next.length ? "ready" : "empty");
    });
    return () => {
      cancelled = true;
    };
  }, [mode, forecastKp, forecastIssueIso, setPoints]);

  useEffect(() => {
    if (!playing) {
      return;
    }
    timer.current = window.setInterval(() => {
      const state = useTimelineStore.getState();
      if (state.index >= state.points.length - 1) {
        setPlaying(false);
        return;
      }
      state.setIndex(state.index + 1);
    }, 1000 / PLAY_STEPS_PER_S);
    return () => {
      if (timer.current !== null) {
        window.clearInterval(timer.current);
      }
    };
  }, [playing]);

  const chart = useMemo(() => {
    if (points.length === 0) {
      return null;
    }
    const start = points[0].timeMs;
    const end = points[points.length - 1].timeMs;
    const span = Math.max(1, end - start);
    let step = Infinity;
    for (let i = 1; i < points.length; i += 1) {
      step = Math.min(step, points[i].timeMs - points[i - 1].timeMs);
    }
    const barWidth = Math.max(1.5, Math.min(24, (Number.isFinite(step) ? step : span) / span * 1000 * 0.8));
    const x = (timeMs: number) => 8 + ((timeMs - start) / span) * 984;
    const y = (kp: number) => 112 - (Math.max(0, Math.min(9, kp)) / 9) * 100;
    const flux = points.map((point) => point.protonPfu);
    const logY = (pfu: number) => 112 - ((Math.log10(Math.max(pfu, 0.1)) + 1) / 6) * 100;
    const protonPath = flux
      .map((pfu, i) => (pfu === null ? null : `${x(points[i].timeMs).toFixed(1)},${logY(pfu).toFixed(1)}`))
      .filter((value): value is string => value !== null);
    // AI +3 h forecast for each 3-hour block, issued at the block start (target hour = issue + 2 h).
    const ai = AI_REPLAY.rows
      .filter((row) => row.horizonH === 3)
      .map((row) => ({ t: Date.parse(row.target), p10: row.p10, p50: row.p50, p90: row.p90 }))
      .filter((row) => row.t >= start && row.t <= end)
      .sort((left, right) => left.t - right.t);
    const aiLine = ai.map((row) => `${x(row.t).toFixed(1)},${y(row.p50).toFixed(1)}`).join(" ");
    const aiBand = [
      ...ai.map((row) => `${x(row.t).toFixed(1)},${y(row.p90).toFixed(1)}`),
      ...ai.slice().reverse().map((row) => `${x(row.t).toFixed(1)},${y(row.p10).toFixed(1)}`),
    ].join(" ");
    return { x, y, barWidth, protonPath, logY, aiLine, aiBand };
  }, [points]);

  const point = points[index] ?? null;
  const markers = mode === "may2024" ? may2024.markers.sepOnset.map((iso) => utc(iso)) : [];
  const g = point?.kp !== null && point?.kp !== undefined ? gscale(point.kp) : null;
  const s = point?.protonPfu !== null && point?.protonPfu !== undefined ? sscale(point.protonPfu) : null;

  return (
    <section className="rok-panel timeline" aria-labelledby="timeline-title">
      <div className="timeline__head">
        <div>
          <p className="eyebrow rok-panel__eyebrow">Space weather over time</p>
          <h2 id="timeline-title" className="heading-md rok-panel__title">
            Timeline
          </h2>
        </div>
        <div className="segmented" role="group" aria-label="Timeline period">
          {(
            [
              ["now", "Now and next 24 h"],
              ["may2024", "May 2024 superstorm"],
            ] as [TimelineMode, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="rok-btn rok-btn--sm button"
              aria-pressed={mode === value}
              onClick={() => {
                setPlaying(false);
                setMode(value);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {phase === "loading" && points.length === 0 ? <p className="body rok-muted">Loading</p> : null}
      {phase === "error" ? (
        <p className="body" style={{ color: "var(--status-critical)" }}>
          Error
        </p>
      ) : null}
      {phase === "empty" ? <p className="body rok-muted">Empty</p> : null}

      {chart && point ? (
        <>
          <svg className="timeline__chart" viewBox="0 0 1000 124" preserveAspectRatio="none" aria-hidden="true">
            {[5, 7, 9].map((kp) => (
              <line key={kp} x1="0" x2="1000" y1={chart.y(kp)} y2={chart.y(kp)} className="timeline__grid" />
            ))}
            {points.map((p, i) =>
              p.kp === null ? null : (
                <rect
                  key={p.timeMs}
                  x={chart.x(p.timeMs) - chart.barWidth / 2}
                  y={chart.y(p.kp)}
                  width={chart.barWidth}
                  height={112 - chart.y(p.kp)}
                  fill={p.kind === "forecast" ? "none" : kpColor(p.kp)}
                  stroke={p.kind === "forecast" ? kpColor(p.kp) : "none"}
                  strokeDasharray={p.kind === "forecast" ? "3 2" : undefined}
                  opacity={i === index ? 1 : 0.75}
                />
              ),
            )}
            {points.map((p) =>
              p.kind === "forecast" && p.kpP10 != null && p.kpP90 != null ? (
                <line
                  key={`band-${p.timeMs}`}
                  x1={chart.x(p.timeMs)}
                  x2={chart.x(p.timeMs)}
                  y1={chart.y(p.kpP90)}
                  y2={chart.y(p.kpP10)}
                  className="timeline__band"
                />
              ) : null,
            )}
            {mode === "may2024" && chart.aiLine ? (
              <>
                <polygon points={chart.aiBand} className="timeline__ai-band" />
                <polyline points={chart.aiLine} className="timeline__ai" />
              </>
            ) : null}
            <line x1="0" x2="1000" y1={chart.logY(10)} y2={chart.logY(10)} className="timeline__s1" />
            {chart.protonPath.length > 1 ? (
              <polyline points={chart.protonPath.join(" ")} className="timeline__protons" />
            ) : null}
            {markers.map((at) => (
              <line key={at} x1={chart.x(at)} x2={chart.x(at)} y1="4" y2="112" className="timeline__marker" />
            ))}
            <line x1={chart.x(point.timeMs)} x2={chart.x(point.timeMs)} y1="0" y2="124" className="timeline__cursor" />
          </svg>
          <div className="timeline__controls">
            <button
              type="button"
              className="rok-btn rok-btn--sm button"
              aria-pressed={playing}
              onClick={() => {
                if (!playing && index >= points.length - 1) {
                  setIndex(0);
                }
                setPlaying(!playing);
              }}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <input
              type="range"
              aria-label="Timeline position"
              aria-valuetext={formatUtc(point.timeMs)}
              min={0}
              max={points.length - 1}
              value={index}
              onChange={(event) => {
                setPlaying(false);
                setIndex(Number(event.target.value));
              }}
            />
          </div>
          <dl className="timeline__readout" aria-live="polite">
            <div>
              <dt className="eyebrow rok-subtle">Time</dt>
              <dd className="data-sm">
                {formatUtc(point.timeMs)}{" "}
                <span className="rok-subtle">
                  {point.kind === "forecast" ? "AI forecast P50" : point.kind === "observed" ? "observed" : "test period"}
                </span>
              </dd>
            </div>
            <div>
              <dt className="eyebrow rok-subtle">Geomagnetic</dt>
              <dd className="data-sm">
                {point.kp === null ? (
                  "Kp n/a"
                ) : (
                  <>
                    Kp {point.kp.toFixed(2)} <SourceBadge label={point.kind === "forecast" ? "estimate" : "source"} />{" "}
                    {g ? <StatusBadge status={gStatus(g)}>{g}</StatusBadge> : null}
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt className="eyebrow rok-subtle">Protons above 10 MeV</dt>
              <dd className="data-sm">
                {point.protonPfu === null ? (
                  "n/a"
                ) : (
                  <>
                    {point.protonPfu < 1 ? point.protonPfu.toFixed(2) : point.protonPfu.toFixed(0)} pfu{" "}
                    <SourceBadge label={point.kind === "observed" ? "source" : "estimate"} />{" "}
                    {s ? <StatusBadge status={s === "S0" ? "nominal" : sepActive(point.protonPfu) ? "critical" : "caution"}>{s}</StatusBadge> : null}
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt className="eyebrow rok-subtle">Danger zone edges</dt>
              <dd className="data-sm">
                {point.kp === null ? (
                  "n/a"
                ) : (
                  <>
                    Aurora from {auroralBoundaryMlatDeg(point.kp).toFixed(1)}° <SourceBadge label="estimate" />
                    {point.protonPfu !== null && sepActive(point.protonPfu) ? (
                      <>
                        {" "}
                        · protons reach {sepCutoffMlatDeg(point.kp).toFixed(1)}° <SourceBadge label="estimate" />
                      </>
                    ) : null}{" "}
                    <span className="rok-subtle">magnetic latitude</span>
                  </>
                )}
              </dd>
            </div>
          </dl>
          <p className="note">
            Bars: Kp (filled observed, dashed AI forecast with P10–P90 whisker). Line: GOES protons above 10 MeV, log
            scale; dotted line is the S1 threshold.
            {mode === "may2024"
              ? " Blue line and band: the AI +3 h forecast for each 3-hour block, issued at the block start (P50, P10–P90). Vertical ticks: SEP onsets. Replay protons are integrated from GOES-16 differential channels (estimate), hourly means stamped at the hour's end."
              : " Forecast proton flux repeats the latest observation."}
          </p>
        </>
      ) : null}
    </section>
  );
}
