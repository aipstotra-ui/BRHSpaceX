"use client";

import { useEffect, useMemo, useState } from "react";

import { useImpactStore } from "@/components/home/impactStore";
import { replayInputsAt } from "@/components/home/useAiAnalysis";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { type ActionName } from "@/lib/engine/costCheck";
import { exposureWeight, scorePlan, type ReplayHour } from "@/lib/engine/replayOnOrbit";
import type { StormEvent } from "@/lib/events/registry";
import { useOrbitStore } from "@/lib/store/orbit";
import { decide, policyVector } from "@/lib/ml/policyInput";
import { runPolicyProbabilities } from "@/lib/ml/policy";
import { useShellStore } from "@/lib/store";

const ACTION_COLOR: Record<ActionName, string> = {
  continue: "var(--line)",
  checkpoint: "var(--thermal-2)",
  throttle: "var(--status-caution)",
  "safe mode": "var(--status-critical)",
};

function Lane({ title, plan, cursor }: { title: string; plan: ActionName[]; cursor: number }) {
  return (
    <div className="lane">
      <span className="eyebrow rok-subtle lane__title">{title}</span>
      <svg viewBox={`0 0 ${plan.length} 1`} preserveAspectRatio="none" className="lane__bar" aria-hidden="true">
        {plan.map((action, index) => (
          <rect key={index} x={index} y={0} width={1} height={1} fill={ACTION_COLOR[action]} />
        ))}
        <rect x={cursor} y={0} width={1} height={1} fill="var(--accent)" />
      </svg>
    </div>
  );
}

export function AiPolicyReplay({
  event,
  hours,
  amounts,
  hindsight,
  hindsightCost,
  hindsightDowntime,
  cursor,
}: {
  event: StormEvent;
  hours: ReplayHour[];
  amounts: number[];
  hindsight: ActionName[];
  hindsightCost: number;
  hindsightDowntime: number;
  cursor: number;
}) {
  const result = useImpactStore((state) => state.result);
  const presetId = useShellStore((state) => state.presetId);
  const altitudeKm = useOrbitStore((state) => state.altitudeKm);
  const inclinationDeg = useOrbitStore((state) => state.inclinationDeg);
  const [plan, setPlan] = useState<ActionName[] | null>(null);
  const [failed, setFailed] = useState(false);

  const auroral = result?.auroralFraction.mid;
  const eclipse = result?.eclipseFraction.mid;

  useEffect(() => {
    if (auroral === undefined || eclipse === undefined) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const next: ActionName[] = [];
        let previous: ActionName = "continue";
        for (const hour of hours) {
          const known = replayInputsAt(event, Date.parse(hour.time));
          const band = known.issue.find((row) => row.horizonH === 3);
          if (known.kp === null || known.dst === null || !band) {
            next.push(previous);
            continue;
          }
          const context = {
            kp: known.kp,
            forecast: { p10: band.p10, p50: band.p50, p90: band.p90 },
            dst: known.dst,
            // GOES hourly means are stamped at the hour's end, so this hour's value is already published.
            saa: exposureWeight({ altitudeKm, inclinationDeg }, known.kp, hour.goesProtonFlux ?? null),
            auroral,
            eclipse,
            presetId,
          };
          previous = decide(await runPolicyProbabilities(policyVector(context)), context).final;
          next.push(previous);
          if (cancelled) {
            return;
          }
        }
        setPlan(next);
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [event, hours, auroral, eclipse, presetId, altitudeKm, inclinationDeg]);

  const always = useMemo(() => hours.map(() => "continue" as ActionName), [hours]);
  const summary = useMemo(() => {
    if (!plan) {
      return null;
    }
    const ai = scorePlan(amounts, plan);
    const naive = scorePlan(amounts, always);
    const agree = plan.filter((action, index) => action === hindsight[index]).length / plan.length;
    const firstMove = hours.find((_, index) => plan[index] !== "continue")?.time ?? null;
    return { ai, naive, agree, firstMove };
  }, [plan, amounts, always, hindsight, hours]);

  if (failed) {
    return <p className="body error">Error</p>;
  }
  if (!plan || !summary) {
    return <p className="body rok-muted">Running the AI policy on {hours.length} hours</p>;
  }

  const saved = summary.naive.cost > 0 ? 1 - summary.ai.cost / summary.naive.cost : 0;
  const rows: [string, { cost: number; downtimeHours: number }][] = [
    ["Always continue", summary.naive],
    ["AI policy", summary.ai],
    ["Hindsight plan (sees next 8 h)", { cost: hindsightCost, downtimeHours: hindsightDowntime }],
  ];

  return (
    <div className="stack stack--tight">
      <h3 className="heading-sm">AI policy vs hindsight</h3>
      <div className="lanes">
        <Lane title="AI policy" plan={plan} cursor={cursor} />
        <Lane title="Hindsight plan" plan={hindsight} cursor={cursor} />
        <ul className="legend__items lanes__legend">
          {(Object.keys(ACTION_COLOR) as ActionName[]).map((action) => (
            <li key={action} className="eyebrow">
              <span className="swatch" style={{ background: ACTION_COLOR[action] }} aria-hidden="true" />
              {action}
            </li>
          ))}
        </ul>
      </div>
      <div className="table-scroll">
        <table className="rok-table">
          <caption className="sr-only">Replay cost of three action plans on the chosen orbit</caption>
          <thead>
            <tr>
              <th scope="col">Plan</th>
              <th scope="col" className="rok-num">
                Cost
              </th>
              <th scope="col" className="rok-num">
                Downtime
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, score]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td className="rok-num">
                  <span className="num">
                    {score.cost.toFixed(1)} <SourceBadge label="estimate" />
                  </span>
                </td>
                <td className="rok-num">{score.downtimeHours.toFixed(1)} h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="body-sm">
        The AI policy {saved >= 0 ? "cut" : "raised"} the storm cost by {Math.abs(Math.round(saved * 100))} % versus always
        continuing, and matched the hindsight plan in {Math.round(summary.agree * 100)} % of hours.
        {summary.firstMove ? ` First protective move: ${summary.firstMove.slice(5, 16).replace("T", " ")} UTC.` : ""}
      </p>
      <p className="note">
        At each hour the AI sees only what was published by then: the last completed Kp block, the previous hour&apos;s
        Dst, the latest finished AI forecast and GOES protons. The hindsight plan, the target
        the policy was trained to imitate, picks each hour&apos;s action knowing the real next 8 hours. It is a strong
        reference, not a guaranteed minimum, so the AI can occasionally beat it. The policy was trained with the Kp of
        the block in progress, same-hour Dst and the current forecast issue (a known issue in its training data), so
        the replay&apos;s inputs are 1–3 h older than in training. That makes this result, if anything, pessimistic.
      </p>
    </div>
  );
}
