import type { ActionName } from "@/lib/types";

import policyFile from "../../ml/policy_costs.json";

export interface ActionCost {
  downtime_hours: number;
  uncorrectable_weight: number;
  switch_cost: number;
  power_scale: number;
  label: "estimate";
}

export interface PolicyCosts {
  label: "estimate";
  note: string;
  downtime_cost_per_hour: number;
  actions: Record<ActionName, ActionCost>;
}

export const POLICY_COSTS = policyFile as PolicyCosts;

export const ACTION_ORDER: ActionName[] = ["continue", "checkpoint", "throttle", "safe mode"];

export function actionCost(name: ActionName): ActionCost {
  return POLICY_COSTS.actions[name];
}
