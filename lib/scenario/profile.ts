export interface ScenarioProfileInput {
  cmeSpeedKmS: number;
  bzNt: number;
  densityCm3: number;
  durationH: number;
  arrivalTime: string;
  baselineSpeedKmS?: number;
  baselineBzNt?: number;
  baselineDensityCm3?: number;
}

export interface ProfileHour {
  time: string;
  speedKmS: number;
  bzNt: number;
  densityCm3: number;
  pdynNpa: number;
  phase: "before" | "during" | "after";
}

/** Dynamic pressure when Na/Np is missing: (2/10^6) * n * V^2, from omni2.text. */
export function pdyn(densityCm3: number, speedKmS: number): number {
  return (2 / 1e6) * densityCm3 * speedKmS * speedKmS;
}

export function buildProfile(input: ScenarioProfileInput, hoursAfter = 6): ProfileHour[] {
  const baseline = {
    speedKmS: input.baselineSpeedKmS ?? 400,
    bzNt: input.baselineBzNt ?? 0,
    densityCm3: input.baselineDensityCm3 ?? 5,
  };
  const arrival = Date.parse(input.arrivalTime);
  const durationMs = input.durationH * 3600 * 1000;
  const relaxMs = hoursAfter * 3600 * 1000;
  const start = arrival - 3 * 3600 * 1000;
  const end = arrival + durationMs + relaxMs;
  const hours: ProfileHour[] = [];
  for (let time = start; time <= end; time += 3600 * 1000) {
    let phase: ProfileHour["phase"] = "before";
    let speedKmS = baseline.speedKmS;
    let bzNt = baseline.bzNt;
    let densityCm3 = baseline.densityCm3;
    if (input.durationH > 0 && time >= arrival && time < arrival + durationMs) {
      phase = "during";
      speedKmS = input.cmeSpeedKmS;
      bzNt = input.bzNt;
      densityCm3 = input.densityCm3;
    } else if (time >= arrival + durationMs && time < arrival + durationMs + relaxMs && input.durationH > 0) {
      phase = "after";
      const fade = (time - (arrival + durationMs)) / relaxMs;
      speedKmS = input.cmeSpeedKmS + (baseline.speedKmS - input.cmeSpeedKmS) * fade;
      bzNt = input.bzNt + (baseline.bzNt - input.bzNt) * fade;
      densityCm3 = input.densityCm3 + (baseline.densityCm3 - input.densityCm3) * fade;
    }
    hours.push({
      time: new Date(time).toISOString(),
      speedKmS,
      bzNt,
      densityCm3,
      pdynNpa: pdyn(densityCm3, speedKmS),
      phase,
    });
  }
  return hours;
}
