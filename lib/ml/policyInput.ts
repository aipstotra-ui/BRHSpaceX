import { ACTIONS, type ActionName, applyOverride } from "@/lib/engine/costCheck";

/**
 * Inputs for public/models/policy.onnx, in the order of ml/train_policy.py FEATURES.
 * The policy was trained on three chip profiles (ml/build_oracle.py CHIPS). A preset maps to the nearest one.
 */
export const POLICY_FEATURES = [
  "kp",
  "kp_p10",
  "kp_p50",
  "kp_p90",
  "dst",
  "saa",
  "auroral",
  "eclipse",
  "sigma_bits",
  "shielding",
  "ecc",
] as const;

interface ChipProfile {
  name: string;
  sigmaBits: number;
  shielding: number;
  ecc: number;
}

const PROFILES: Record<string, ChipProfile> = {
  ai1: { name: "Starmind AI1", sigmaBits: 1.0, shielding: 5.0, ecc: 1.0 },
  orin: { name: "Jetson AGX Orin", sigmaBits: 2.0, shielding: 2.0, ecc: 0.7 },
  h100: { name: "NVIDIA H100", sigmaBits: 1.4, shielding: 3.0, ecc: 0.8 },
};

/** estimate: presets without their own training profile use the closest class. */
const PRESET_PROFILE: Record<string, keyof typeof PROFILES> = {
  "ai1-spacex": "ai1",
  "ai1-alternate": "ai1",
  "h100-starcloud": "h100",
  "tpu-v6e": "h100",
  "orin-agx": "orin",
  "orin-nx": "orin",
  samrh71: "ai1",
  custom: "ai1",
};

export function chipProfile(presetId: string): ChipProfile & { exact: boolean } {
  const key = PRESET_PROFILE[presetId] ?? "ai1";
  const exact = presetId === "ai1-spacex" || presetId === "h100-starcloud" || presetId === "orin-agx";
  return { ...PROFILES[key], exact };
}

export interface PolicyContext {
  kp: number;
  forecast: { p10: number; p50: number; p90: number };
  dst: number;
  saa: number;
  auroral: number;
  eclipse: number;
  presetId: string;
}

export function policyVector(context: PolicyContext): Float32Array {
  const chip = chipProfile(context.presetId);
  return Float32Array.from([
    context.kp,
    context.forecast.p10,
    context.forecast.p50,
    context.forecast.p90,
    context.dst,
    context.saa,
    context.auroral,
    context.eclipse,
    chip.sigmaBits,
    chip.shielding,
    chip.ecc,
  ]);
}

export interface PolicyDecision {
  /** What the trained classifier chose. */
  model: ActionName;
  confidence: number;
  probabilities: Record<ActionName, number>;
  /** After the runtime cost check (15% rule) at the forecast P50. */
  final: ActionName;
  overridden: boolean;
}

export function decide(probabilities: number[], context: PolicyContext): PolicyDecision {
  let best = 0;
  probabilities.forEach((value, index) => {
    if (value > probabilities[best]) {
      best = index;
    }
  });
  const model = ACTIONS[best] ?? "continue";
  const chip = chipProfile(context.presetId);
  const final = applyOverride(model, context.forecast.p50, context.saa, chip.sigmaBits);
  return {
    model,
    confidence: probabilities[best] ?? 0,
    probabilities: Object.fromEntries(ACTIONS.map((action, index) => [action, probabilities[index] ?? 0])) as Record<
      ActionName,
      number
    >,
    final,
    overridden: final !== model,
  };
}
