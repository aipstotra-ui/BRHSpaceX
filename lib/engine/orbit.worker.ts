import { orbitImpact, type OrbitImpactInput } from "@/lib/engine/orbitImpact";

interface Job {
  id: number;
  input: OrbitImpactInput;
}

interface WorkerScope {
  onmessage: ((event: MessageEvent<Job>) => void) | null;
  postMessage: (message: unknown) => void;
}

const scope = globalThis as unknown as WorkerScope;

scope.onmessage = (event: MessageEvent<Job>) => {
  const started = performance.now();
  try {
    const result = orbitImpact(event.data.input);
    scope.postMessage({
      id: event.data.id,
      ok: true,
      result,
      ms: performance.now() - started,
    });
  } catch (error) {
    scope.postMessage({
      id: event.data.id,
      ok: false,
      message: error instanceof Error ? error.message : "orbit worker failed",
    });
  }
};

export {};
