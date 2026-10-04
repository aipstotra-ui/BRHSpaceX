/** Policy probabilities. Import from client code only. */

import { runSession } from "@/lib/ml/ort";

/**
 * Shares the forecast models' onnxruntime queue: onnxruntime-web allows one session.run at a time,
 * and a second concurrent run fails with "Session already started".
 */
export async function runPolicyProbabilities(features: Float32Array): Promise<number[]> {
  return runSession("policy.onnx", features, "probabilities");
}
