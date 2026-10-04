/** Policy probabilities. Import from client code only. */

const sessions = new Map<string, Promise<PolicySession>>();

type PolicySession = {
  run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: ArrayLike<number> }>>;
};

type OrtModule = {
  env: { wasm: { wasmPaths?: string; numThreads: number } };
  InferenceSession: {
    create: (source: string, options?: { executionProviders?: string[] }) => Promise<PolicySession>;
  };
  Tensor: new (type: "float32", data: Float32Array, dims: number[]) => unknown;
};

export async function runPolicyProbabilities(features: Float32Array): Promise<number[]> {
  const ort = (await import("onnxruntime-web")) as unknown as OrtModule;
  ort.env.wasm.numThreads = 1;
  const source = typeof window === "undefined" ? `${process.cwd()}/public/models/policy.onnx` : "/models/policy.onnx";
  let pending = sessions.get(source);
  if (!pending) {
    pending = ort.InferenceSession.create(source, { executionProviders: ["wasm"] });
    sessions.set(source, pending);
  }
  const session = await pending;
  const tensor = new ort.Tensor("float32", features, [1, features.length]);
  const result = await session.run({ features: tensor });
  return Array.from(result.probabilities?.data ?? []);
}
