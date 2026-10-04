import climatology from "@/data/orbit/climatology.json";

export const HISTORY_START = climatology.years[0] ?? 1963;
export const HISTORY_END = climatology.years[climatology.years.length - 1] ?? 2026;

export type MissionWindow = "quiet" | "stormy" | "cycle";

export type TimeChoice =
  | { kind: "past"; year: number }
  | { kind: "now" }
  | { kind: "mission"; window: MissionWindow };

type Levels = Record<string, { blocks: number; hours: number }>;

const SEVERE = ["G3", "G4", "G5"] as const;

function hours(levels: Levels, name: string): number {
  return levels[name]?.hours ?? 0;
}

export function severeShare(levels: Levels): number {
  const names = ["G0", "G1", "G2", "G3", "G4", "G5"];
  let total = 0;
  let severe = 0;
  for (const name of names) {
    const value = hours(levels, name);
    total += value;
    if ((SEVERE as readonly string[]).includes(name)) {
      severe += value;
    }
  }
  if (total <= 0) {
    return 0;
  }
  return severe / total;
}

function addLevels(left: Levels, right: Levels): Levels {
  const names = new Set([...Object.keys(left), ...Object.keys(right)]);
  const sum: Levels = {};
  for (const name of names) {
    sum[name] = {
      blocks: (left[name]?.blocks ?? 0) + (right[name]?.blocks ?? 0),
      hours: hours(left, name) + hours(right, name),
    };
  }
  return sum;
}

const byYear = climatology.byYear as Record<string, Levels>;
const byPhase = climatology.byPhase as Record<string, { levels: Levels }>;

export function levelsFor(choice: TimeChoice): Levels {
  if (choice.kind === "past" || choice.kind === "now") {
    const year = choice.kind === "now" ? HISTORY_END : choice.year;
    return byYear[String(year)] ?? {};
  }
  if (choice.window === "quiet") {
    return byPhase.low?.levels ?? {};
  }
  if (choice.window === "stormy") {
    return byPhase.high?.levels ?? {};
  }
  return addLevels(addLevels(byPhase.low?.levels ?? {}, byPhase.mid?.levels ?? {}), byPhase.high?.levels ?? {});
}

export function periodLabel(choice: TimeChoice): string {
  if (choice.kind === "past") {
    return `${choice.year}, measured storms`;
  }
  if (choice.kind === "now") {
    return "Right now, and the next day";
  }
  if (choice.window === "quiet") {
    return "A quiet Sun, from the measured years";
  }
  if (choice.window === "stormy") {
    return "A stormy Sun, from the measured years";
  }
  return "An 11-year cycle, from the measured years";
}

export type SafetyWord = "Safe" | "Watch" | "Unsafe";

export interface SafetyInput {
  saa: number;
  eclipse: number;
  thermalMarginC: number;
  lifetimeYears: number;
  severeShare: number;
  liveKp?: number | null;
}

export interface SafetyReading {
  score: number;
  word: SafetyWord;
  reasons: string[];
}

function wordFor(score: number): SafetyWord {
  if (score >= 75) {
    return "Safe";
  }
  if (score >= 45) {
    return "Watch";
  }
  return "Unsafe";
}

/** estimate: the weights turn radiation, storms, shadow, heat, and lifetime into one 0–100 score. */
export function safetyReading(input: SafetyInput): SafetyReading {
  const storm = Math.min(40, input.severeShare * 500);
  const radiation = Math.min(30, Math.max(0, input.saa) * 30);
  const shadow = Math.min(12, Math.max(0, input.eclipse) * 12);
  const heat = input.thermalMarginC < 0 ? Math.min(20, -input.thermalMarginC / 2) : 0;
  const life = input.lifetimeYears < 5 ? ((5 - Math.max(0, input.lifetimeYears)) / 5) * 20 : 0;
  const live = input.liveKp != null && input.liveKp >= 5 ? Math.min(18, (input.liveKp - 4) * 6) : 0;
  const score = Math.round(Math.min(100, Math.max(0, 100 - storm - radiation - shadow - heat - life - live)));
  const ranked = [
    { cost: storm, text: "Strong storms are common in this period." },
    { cost: radiation, text: "The orbit spends time in the South Atlantic radiation zone." },
    { cost: shadow, text: "The satellite spends a long stretch in Earth's shadow." },
    { cost: heat, text: "The chip runs hotter than its limit." },
    { cost: life, text: "The satellite wears out in under five years." },
    { cost: live, text: "A storm is underway right now." },
  ]
    .filter((item) => item.cost >= 4)
    .sort((left, right) => right.cost - left.cost);
  const reasons = ranked.slice(0, 3).map((item) => item.text);
  if (reasons.length === 0) {
    reasons.push("Storms, radiation, heat, and lifetime all sit in a calm range.");
  }
  return { score, word: wordFor(score), reasons };
}
