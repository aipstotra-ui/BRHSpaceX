import costs from "@/ml/policy_costs.json";

export const ACTIONS = ["continue", "checkpoint", "throttle", "safe mode"] as const;
export type ActionName = (typeof ACTIONS)[number];

/** estimate: override the classifier when it is more than this far above the cheapest action. */
export const OVERRIDE_PERCENT = 15;

type ActionCost = {
  downtime_hours: number;
  uncorrectable_weight: number;
  switch_cost: number;
};

const table = costs.actions as Record<ActionName, ActionCost>;

export function actionCost(uncorrectable: number, action: ActionName): number {
  const row = table[action];
  return (
    row.downtime_hours * costs.downtime_cost_per_hour +
    row.uncorrectable_weight * uncorrectable +
    row.switch_cost
  );
}

export function uncorrectable(kp: number, saa: number, sigmaBits: number): number {
  return Math.max(0, kp - 2) * saa * sigmaBits;
}

export function cheapestAction(kp: number, saa: number, sigmaBits: number): ActionName {
  let best: ActionName = "continue";
  let bestCost = Number.POSITIVE_INFINITY;
  const amount = uncorrectable(kp, saa, sigmaBits);
  for (const action of ACTIONS) {
    const cost = actionCost(amount, action);
    if (cost < bestCost) {
      best = action;
      bestCost = cost;
    }
  }
  return best;
}

export function applyOverride(guess: ActionName, kp: number, saa: number, sigmaBits: number): ActionName {
  const amount = uncorrectable(kp, saa, sigmaBits);
  const best = cheapestAction(kp, saa, sigmaBits);
  if (actionCost(amount, guess) > actionCost(amount, best) * (1 + OVERRIDE_PERCENT / 100)) {
    return best;
  }
  return guess;
}
