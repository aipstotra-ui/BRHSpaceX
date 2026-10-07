"use client";

import forecastReport from "@/data/validation/forecast.json";
import { replayForecastFor, useAiAnalysis } from "@/components/home/useAiAnalysis";
import { formatNumber } from "@/components/panels/OrbitImpact";
import { StatusBadge, type Status } from "@/components/ui/StatusBadge";
import { ACTIONS } from "@/lib/engine/costCheck";
import { gscale } from "@/lib/engine/gscale";
import { eventForMode, SPLIT_TEXT, stormCallStats } from "@/lib/events/registry";
import { useTimelineCursor } from "@/lib/store/timeline";

function gStatus(level: string): Status {
  const n = Number(level.slice(1));
  return n >= 3 ? "critical" : n >= 1 ? "caution" : "nominal";
}

function actionStatus(action: string): Status {
  return action === "safe mode" ? "critical" : action === "continue" ? "nominal" : "caution";
}

function hhmm(iso: string): string {
  return iso.slice(5, 16).replace("T", " ") + " UTC";
}

export function AiAnalysis() {
  const cursor = useTimelineCursor();
  const { outlook, decision, phase, chipExact, outsideTraining } = useAiAnalysis();
  const event = eventForMode(cursor.mode);
  const kp3 = forecastReport.rows.find((row) => row.target === "kp" && row.horizon_h === 3);
  const kp24 = forecastReport.rows.find((row) => row.target === "kp" && row.horizon_h === 24);
  const pastCall =
    event && cursor.point
      ? replayForecastFor(event, new Date(cursor.point.timeMs).toISOString().replace(".000Z", "Z"))
      : null;
  const warning = event?.replay.aiForecast.firstWarning ?? null;
  const calls = event ? stormCallStats(event.replay) : null;

  return (
    <section className="rok-panel ai" aria-labelledby="ai-title">
      <p className="eyebrow rok-panel__eyebrow">Machine learning on space weather since 1963</p>
      <h2 id="ai-title" className="heading-md rok-panel__title">
        AI analysis
      </h2>
      <div className="ai__grid">
        <div className="ai__cell">
          <h3 className="eyebrow rok-subtle">Forecast · next 24 h</h3>
          {outlook ? (
            <>
              <p className="data-md">
                Kp up to {formatNumber(outlook.peakP50, 1)}{" "}
                <span className="rok-muted body-sm">
                  likely, {formatNumber(outlook.peakP90, 1)} worst case (+{outlook.peakHorizonH} h)
                </span>
              </p>
              <StatusBadge status={gStatus(gscale(outlook.peakP90))}>
                {gscale(outlook.peakP90) === "G0" ? "No storm expected" : `${gscale(outlook.peakP90)} possible`}
              </StatusBadge>
              {pastCall && cursor.point?.kp != null ? (
                <p className="body-sm">
                  For this 3-hour block the AI predicted Kp {formatNumber(pastCall.p50, 1)} (range{" "}
                  {formatNumber(pastCall.p10, 1)}–{formatNumber(pastCall.p90, 1)}), issued at {hhmm(pastCall.issued)}.
                  Observed: {cursor.point.kp.toFixed(1)}.
                </p>
              ) : null}
              <p className="note">
                24 gradient-boosted models (Kp and Dst, +3 to +24 h, P10/P50/P90) trained on OMNI 1963–2019.{" "}
                {event
                  ? `For ${event.shortName} the same models were run offline on archived OMNI inputs`
                  : "Running in your browser on live NOAA solar wind"}
                {outlook.issuedIso ? `, issued ${hhmm(outlook.issuedIso)}` : ""}.
              </p>
            </>
          ) : (
            <p className="body rok-muted">{phase === "error" ? "Error" : "Loading"}</p>
          )}
        </div>

        <div className="ai__cell">
          <h3 className="eyebrow rok-subtle">Recommended action now</h3>
          {decision ? (
            <>
              <p className="data-md ai__action">
                <StatusBadge status={actionStatus(decision.final)}>{decision.final}</StatusBadge>
                <span className="body-sm rok-muted">{Math.round(decision.confidence * 100)} % confident</span>
              </p>
              <ul className="ai__probs" aria-label="Policy probabilities">
                {ACTIONS.map((action) => (
                  <li key={action}>
                    <span className="eyebrow rok-subtle">{action}</span>
                    <span className="rok-progress__track">
                      <span
                        className="rok-progress__fill"
                        style={{ width: `${Math.round(decision.probabilities[action] * 100)}%`, display: "block" }}
                      />
                    </span>
                    <span className="data-sm">{Math.round(decision.probabilities[action] * 100)}%</span>
                  </li>
                ))}
              </ul>
              {decision.overridden ? (
                <p className="note">
                  The model chose {decision.model}; the cost check switched to {decision.final} because it is more than 15 %
                  cheaper at the forecast P50.
                </p>
              ) : null}
              <p className="note">
                A classifier trained on historical storms to pick the action that hindsight shows was cheapest over the
                next 8 h. Here it is fed only what was published at that moment: the last completed Kp block, the
                latest finished forecast, the previous hour&apos;s Dst, this orbit&apos;s exposure and the chip.
                {chipExact ? "" : " This chip uses the nearest of the three training chip profiles."}
                {outsideTraining ? " This orbit's exposure is above the training range, so the model acts as at its edge." : ""}
              </p>
            </>
          ) : (
            <p className="body rok-muted">{phase === "error" ? "Error" : "Loading"}</p>
          )}
        </div>

        <div className="ai__cell">
          <h3 className="eyebrow rok-subtle">{event ? `How it did in ${event.shortName}` : "Track record (2023–2026 test)"}</h3>
          {event && warning ? (
            <>
              <p className="data-md">
                {warning.leadHours >= 0
                  ? `${formatNumber(warning.leadHours, 0)} h warning`
                  : `${formatNumber(-warning.leadHours, 0)} h late`}
              </p>
              <p className="body-sm">
                First G3+ warning (P90 ≥ Kp {warning.kp}) issued {hhmm(warning.issued)}, usable from{" "}
                {hhmm(warning.usableAt)}. The first Kp {warning.kp} block began at {hhmm(warning.firstObservedAt)}.
                {calls && calls.blocks > 0
                  ? ` In the ${calls.blocks} G3+ blocks the +3 h median ran ${calls.medianBelowAll ? "below the observed Kp in every one" : "below the observed Kp in some"}; the P90 edge reached it in ${calls.p90Reached} of ${calls.blocks}${calls.missedFirst ? " (it missed the first)" : ""}.`
                  : ""}
              </p>
              <p className="note">
                The model reads solar wind measured about an hour upstream of Earth, so it reacts to a storm rather than
                predicting the CME days ahead. This event is {SPLIT_TEXT[event.split]}.
              </p>
            </>
          ) : event ? (
            <>
              <p className="data-md">No G3+ storm to score</p>
              <p className="body-sm">
                Kp never reached 7 in this replay, so there is no first warning or G3+ block record. The forecast
                band above still shows the +3 h call for each block.
              </p>
              <p className="note">This event is {SPLIT_TEXT[event.split]}.</p>
            </>
          ) : kp3 && kp24 ? (
            <>
              <p className="data-md">{Math.round(kp3.skill * 100)} % better than persistence</p>
              <p className="body-sm">
                +3 h Kp error {kp3.mae_p50.toFixed(2)} vs {kp3.mae_persist.toFixed(2)} for &quot;no change&quot;;{" "}
                {Math.round(kp3.coverage_p10_p90 * 100)} % of outcomes inside the P10–P90 band. At +24 h:{" "}
                {Math.round(kp24.skill * 100)} % better.
              </p>
              <p className="note">
                Scored once on {kp3.n.toLocaleString()} unseen 3-hour blocks from 2023 to 2026 ({forecastReport.model_version}).
              </p>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
