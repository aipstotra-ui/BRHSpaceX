"use client";

import { useEffect, useState } from "react";

import { SourceBadge } from "@/components/ui/SourceBadge";
import { buildHourlyFromFeeds, computeFeatureMap, issueTimeIso, vectorFromMap } from "@/lib/ml/features";
import { calibrateQuantiles, type TargetName } from "@/lib/ml/forecast";
import { runModel } from "@/lib/ml/ort";
import type { SourceLabel } from "@/lib/types";
import forecastReport from "@/data/validation/forecast.json";
import modelCard from "@/public/models/model-card.json";

type Phase = "loading" | "error" | "empty" | "ready";

type ScoreRow = (typeof forecastReport.rows)[number];

type Band = {
  target: TargetName;
  horizon: number;
  p10: number;
  p50: number;
  p90: number;
  noaaKp: number | null;
};

type KpRow = { time_tag: string; Kp: number };
type MagRow = { time_tag: string; bz_gsm: number | null; by_gsm: number | null };
type WindRow = { time_tag: string; proton_speed: number; proton_density: number };
type DstRow = { time_tag: string; dst: number };
type F107Row = { time_tag: string; flux: number; reporting_schedule: string };
type PredictedKp = { time_tag: string; kp: number };

const HORIZONS = [3, 6, 12, 24] as const;

function NumberValue({
  value,
  digits,
  label,
}: {
  value: number;
  digits: number;
  label: SourceLabel;
}) {
  return (
    <span>
      {value.toFixed(digits)} <SourceBadge label={label} />
    </span>
  );
}

async function readFeed<T>(feed: string): Promise<T> {
  const response = await fetch(`/api/data/${feed}`);
  if (!response.ok) {
    throw new Error(feed);
  }
  const body = (await response.json()) as { data?: T };
  if (!body.data) {
    throw new Error(feed);
  }
  return body.data;
}

function noaaForHorizon(rows: PredictedKp[], issue: string, horizon: number): number | null {
  const target = Date.parse(issue) + (horizon - 3) * 60 * 60 * 1000;
  const match = rows.find((row) => {
    const stamp = Date.parse(row.time_tag);
    return Number.isFinite(stamp) && Math.abs(stamp - target) < 60 * 1000;
  });
  return match ? match.kp : null;
}

function skillLine(rows: ScoreRow[]): string {
  const parts = rows.map(
    (row) =>
      `${row.target.toUpperCase()} +${row.horizon_h} h skill ${row.skill.toFixed(3)}`,
  );
  return `Persistence is strong at +3 h. Test skill (${forecastReport.model_version}, ${forecastReport.evaluated_at}): ${parts.join("; ")}.`;
}

export function AIForecast() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [bands, setBands] = useState<Band[]>([]);
  const [issue, setIssue] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [mag, wind, kp, dst, f107, predicted] = await Promise.all([
          readFeed<MagRow[]>("rtsw_mag_1m"),
          readFeed<WindRow[]>("rtsw_wind_1m"),
          readFeed<KpRow[]>("kp"),
          readFeed<DstRow[]>("dst"),
          readFeed<F107Row[]>("f107"),
          readFeed<PredictedKp[]>("kp_forecast"),
        ]);
        const now = new Date();
        const issueIso = issueTimeIso(now);
        const hourly = buildHourlyFromFeeds(now, mag, wind, kp, dst, f107);
        const map = computeFeatureMap(hourly, issueIso);
        const vector = vectorFromMap(modelCard.feature_names, map);
        const raw = new Map<string, { target: TargetName; horizon: number; p10?: number; p50?: number; p90?: number }>();
        for (const model of modelCard.models) {
          const target = model.target === "dst" ? "dst" : "kp";
          const key = `${target}-${model.horizon_h}`;
          const slot = raw.get(key) ?? { target, horizon: model.horizon_h };
          const value = await runModel(model.file, vector, model.output_name);
          if (model.quantile === 0.1) {
            slot.p10 = value;
          } else if (model.quantile === 0.5) {
            slot.p50 = value;
          } else {
            slot.p90 = value;
          }
          raw.set(key, slot);
        }
        const next: Band[] = [];
        for (const slot of raw.values()) {
          if (slot.p10 === undefined || slot.p50 === undefined || slot.p90 === undefined) {
            continue;
          }
          if (![slot.p10, slot.p50, slot.p90].every((value) => Number.isFinite(value))) {
            continue;
          }
          const tag = `${slot.target}_h${String(slot.horizon).padStart(2, "0")}`;
          const delta = modelCard.calibration[tag as keyof typeof modelCard.calibration];
          const ordered = calibrateQuantiles(slot.target, slot.p10, slot.p50, slot.p90, delta);
          next.push({
            target: slot.target,
            horizon: slot.horizon,
            p10: ordered.p10,
            p50: ordered.p50,
            p90: ordered.p90,
            noaaKp: slot.target === "kp" ? noaaForHorizon(predicted, issueIso, slot.horizon) : null,
          });
        }
        if (cancelled) {
          return;
        }
        setIssue(issueIso);
        setBands(next);
        setPhase(next.length === 0 ? "empty" : "ready");
      } catch {
        if (!cancelled) {
          setPhase("error");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const digits = (target: TargetName) => (target === "kp" ? 2 : 1);

  return (
    <div data-testid="ai-forecast">
      <p className="body">{skillLine(forecastReport.rows)}</p>
      <p className="body rok-muted">
        Live bands use recent SWPC inputs in a model trained on OMNI. Treat them as an estimate.
      </p>
      {phase === "loading" ? <p className="body rok-muted">Loading</p> : null}
      {phase === "error" ? (
        <p className="body" style={{ color: "var(--status-critical)" }}>
          Error
        </p>
      ) : null}
      {phase === "empty" ? <p className="body rok-muted">Empty</p> : null}
      {phase === "ready" ? (
        <table className="body">
          <caption className="body">
            Issue {issue}. Ordered P10, P50, P90 after calibration.
          </caption>
          <thead>
            <tr>
              <th>Target</th>
              <th>Horizon</th>
              <th>P10</th>
              <th>P50</th>
              <th>P90</th>
              <th>NOAA predicted Kp</th>
            </tr>
          </thead>
          <tbody>
            {HORIZONS.flatMap((horizon) =>
              (["kp", "dst"] as const).map((target) => {
                const band = bands.find((row) => row.target === target && row.horizon === horizon);
                if (!band) {
                  return null;
                }
                return (
                  <tr key={`${target}-${horizon}`}>
                    <td>{target.toUpperCase()}</td>
                    <td>+{horizon} h</td>
                    <td>
                      <NumberValue value={band.p10} digits={digits(target)} label="estimate" />
                    </td>
                    <td>
                      <NumberValue value={band.p50} digits={digits(target)} label="estimate" />
                    </td>
                    <td>
                      <NumberValue value={band.p90} digits={digits(target)} label="estimate" />
                    </td>
                    <td>
                      {band.noaaKp === null ? (
                        "—"
                      ) : (
                        <NumberValue value={band.noaaKp} digits={2} label="source" />
                      )}
                    </td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      ) : null}
      <h3 className="heading-md">Test skill</h3>
      <table className="body">
        <thead>
          <tr>
            <th>Target</th>
            <th>Horizon</th>
            <th>MAE</th>
            <th>Persistence MAE</th>
            <th>Skill</th>
            <th>RMSE</th>
            <th>Persistence RMSE</th>
            <th>CC</th>
            <th>Persistence CC</th>
            <th>P10–P90 coverage</th>
          </tr>
        </thead>
        <tbody>
          {forecastReport.rows.map((row) => (
            <tr key={`${row.target}-${row.horizon_h}`}>
              <td>{row.target.toUpperCase()}</td>
              <td>+{row.horizon_h} h</td>
              <td>
                <NumberValue value={row.mae_p50} digits={3} label="source" />
              </td>
              <td>
                <NumberValue value={row.mae_persist} digits={3} label="source" />
              </td>
              <td>
                <NumberValue value={row.skill} digits={3} label="source" />
              </td>
              <td>
                <NumberValue value={row.rmse_p50} digits={3} label="source" />
              </td>
              <td>
                <NumberValue value={row.rmse_persist} digits={3} label="source" />
              </td>
              <td>
                <NumberValue value={row.cc_p50} digits={3} label="source" />
              </td>
              <td>
                <NumberValue value={row.cc_persist} digits={3} label="source" />
              </td>
              <td>
                <NumberValue value={row.coverage_p10_p90} digits={3} label="source" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="heading-md">Literature reference</h3>
      <p className="body">Different datasets and periods; not a head-to-head score.</p>
      <table className="body">
        <thead>
          <tr>
            <th>Target</th>
            <th>Horizon</th>
            <th>Line</th>
            <th>RMSE</th>
            <th>CC</th>
          </tr>
        </thead>
        <tbody>
          {forecastReport.literature_reference.map((row) => (
            <tr key={`${row.label}-${row.horizon_h}`}>
              <td>{row.target.toUpperCase()}</td>
              <td>+{row.horizon_h} h</td>
              <td>{row.label}</td>
              <td>
                <NumberValue value={row.rmse} digits={3} label="source" />
              </td>
              <td>
                <NumberValue value={row.cc} digits={3} label="source" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
