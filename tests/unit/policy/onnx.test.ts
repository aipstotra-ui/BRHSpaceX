import { describe, expect, it } from "vitest";

import { runPolicyProbabilities } from "@/lib/ml/policy";
import golden from "@/public/models/golden_policy.json";

describe("policy onnx", () => {
  it("matches Python probabilities within 1e-5", async () => {
    const names = golden.feature_names;
    const features = new Float32Array(names.map((name) => golden.features[name as keyof typeof golden.features]));
    const got = await runPolicyProbabilities(features);
    golden.probabilities.forEach((expected, index) => {
      expect(Math.abs(got[index] - expected)).toBeLessThanOrEqual(1e-5);
    });
  }, 120_000);
});