"use client";

import { replayInputsAt, useAiAnalysis } from "@/components/home/useAiAnalysis";
import { useImpactStore } from "@/components/home/impactStore";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { ACTIONS, actionCost, uncorrectable } from "@/lib/engine/costCheck";
import { exposureWeight } from "@/lib/engine/replayOnOrbit";
import { chipProfile } from "@/lib/ml/policyInput";
import { useOrbitStore } from "@/lib/store/orbit";
import { useTimelineCursor } from "@/lib/store/timeline";
import { useShellStore } from "@/lib/store";

export function BestMove() {
  const { decision, outlook, phase } = useAiAnalysis();
  const result = useImpactStore((state) => state.result);
  const presetId = useShellStore((state) => state.presetId);
  const altitudeKm = useOrbitStore((state) => state.altitudeKm);
  const inclinationDeg = useOrbitStore((state) => state.inclinationDeg);
  const cursor = useTimelineCursor();

  if (!decision || !outlook?.shortBand || !result) {
    return <p className="body rok-muted">{phase === "error" ? "Error" : phase === "empty" ? "Empty" : "Loading"}</p>;
  }

  const sigma = chipProfile(presetId).sigmaBits;
  const knownKp =
    cursor.mode === "may2024" && cursor.point ? replayInputsAt(cursor.point.timeMs).kp : (cursor.point?.kp ?? null);
  const saa = exposureWeight({ altitudeKm, inclinationDeg }, knownKp ?? 2, cursor.point?.protonPfu ?? null);
  const rows = (["p50", "p90"] as const).map((band) => {
    const kp = outlook.shortBand![band];
    const amount = uncorrectable(kp, saa, sigma);
    return { band, kp, costs: ACTIONS.map((action) => actionCost(amount, action)) };
  });

  return (
    <div className="body stack stack--tight">
      <p>
        AI policy: <strong>{decision.final}</strong> ({Math.round(decision.confidence * 100)} % confident).
        {decision.overridden
          ? ` The classifier chose ${decision.model}; the runtime cost check overrode it.`
          : " The runtime cost check agreed."}
      </p>
      <div className="table-scroll">
        <table className="rok-table">
          <caption className="sr-only">Expected cost of each action under the forecast P50 and P90</caption>
          <thead>
            <tr>
              <th scope="col">Action</th>
              <th scope="col" className="rok-num">
                Model probability
              </th>
              {rows.map((row) => (
                <th key={row.band} scope="col" className="rok-num">
                  Cost at {row.band.toUpperCase()} (Kp {row.kp.toFixed(1)})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ACTIONS.map((action, index) => (
              <tr key={action}>
                <th scope="row">
                  {action}
                  {action === decision.final ? " (selected)" : ""}
                </th>
                <td className="rok-num">{Math.round(decision.probabilities[action] * 100)} %</td>
                {rows.map((row) => (
                  <td key={row.band} className="rok-num">
                    <span className="num">
                      {row.costs[index].toFixed(2)} <SourceBadge label="estimate" />
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        Follows the timeline: pick a moment in the May 2024 replay to see what the policy would have done then. Costs use
        the proposed action costs in ml/policy_costs.json.
      </p>
    </div>
  );
}
