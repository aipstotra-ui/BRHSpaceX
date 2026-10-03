/** Browser ONNX sessions. Import this only from client code. */

const sessions = new Map<string, Promise<OrtSession>>();

type OrtSession = {
  run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: ArrayLike<number> }>>;
};

type OrtModule = {
  env: { wasm: { wasmPaths?: string; numThreads: number } };
  InferenceSession: {
    create: (source: string, options?: { executionProviders?: string[] }) => Promise<OrtSession>;
  };
  Tensor: new (type: "float32", data: Float32Array, dims: number[]) => unknown;
};

const WASM_CDN = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/";

async function loadOrt(): Promise<OrtModule> {
  const ort = (await import("onnxruntime-web")) as unknown as OrtModule;
  ort.env.wasm.numThreads = 1;
  if (typeof window !== "undefined") {
    ort.env.wasm.wasmPaths = WASM_CDN;
  }
  return ort;
}

export function modelSource(file: string): string {
  if (typeof window !== "undefined") {
    return `/models/${file}`;
  }
  return `${process.cwd()}/public/models/${file}`;
}

async function sessionFor(file: string): Promise<{ ort: OrtModule; session: OrtSession }> {
  const ort = await loadOrt();
  const source = modelSource(file);
  let pending = sessions.get(source);
  if (!pending) {
    pending = ort.InferenceSession.create(source, {
      executionProviders: ["wasm"],
    });
    sessions.set(source, pending);
  }
  return { ort, session: await pending };
}

export async function runModel(file: string, features: Float32Array, outputName: string): Promise<number> {
  const started = performance.now();
  const { ort, session } = await sessionFor(file);
  const tensor = new ort.Tensor("float32", features, [1, features.length]);
  const result = await session.run({ features: tensor });
  const value = Number(result[outputName]?.data[0]);
  const elapsed = performance.now() - started;
  console.info(`[forecast] session.run ${file} ${elapsed.toFixed(1)} ms`);
  return value;
}
