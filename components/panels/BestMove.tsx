"use client";

import { useMemo } from "react";

import { ACTIONS, actionCost, cheapestAction, uncorrectable } from "@/lib/engine/costCheck";
import { SourceBadge } from "@/components/ui/SourceBadge";

export function BestMove() {
  const kp = 7.7;
  const saa = 0.2;
  const amount = uncorrectable(kp, saa, 1);
  const best = cheapestAction(kp, saa, 1);
  const rows = useMemo(
    () => ACTIONS.map((action) => ({ action, cost: actionCost(amount, action) })),
    [amount],
  );
  return (
    <div className="body">
      <p>
        Best move {best}. Costs are <SourceBadge label="estimate" />. This panel uses the runtime cost check, not a
        claimed forecast skill.
      </p>
      <ul>
        {rows.map((row) => (
          <li key={row.action}>
            {row.action}: {row.cost.toFixed(2)}
            {row.action === best ? " (selected)" : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
