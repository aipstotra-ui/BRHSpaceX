import ranges from "@/data/scenario/ranges.json";

import { cheapestAction } from "@/lib/engine/costCheck";
import { buildProfile, type ScenarioProfileInput } from "@/lib/scenario/profile";

export interface ScenarioResult {
  label: "SCENARIO";
  kp: number;
  action: string;
  warning?: string;
  hours: number;
}

export function baselineKp(): number {
  return 2.33;
}

export function runScenario(input: ScenarioProfileInput & { outsideTraining?: boolean }): ScenarioResult {
  const profile = buildProfile(input);
  const during = profile.filter((hour) => hour.phase === "during");
  const kp = input.durationH <= 0 ? baselineKp() : Math.min(9, Math.max(0, 1 + Math.abs(input.bzNt) / 8));
  const warning =
    input.outsideTraining || input.cmeSpeedKmS > ranges.speedKmS.max || input.cmeSpeedKmS < ranges.speedKmS.min
      ? "outside training range"
      : undefined;
  return {
    label: "SCENARIO",
    kp,
    action: cheapestAction(kp, 0.2, 1),
    warning,
    hours: during.length,
  };
}
