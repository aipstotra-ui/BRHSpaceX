import { createPropagateState, runPropagate, type PropagateRequest } from "@/lib/engine/propagate";

export { createPropagateState, runPropagate };

export function createPropagateWorker(): Worker {
  return new Worker(new URL("./propagate.worker.ts", import.meta.url), { type: "module" });
}

const state = createPropagateState();

function inWorker(): boolean {
  const host = globalThis as { DedicatedWorkerGlobalScope?: new () => object };
  return typeof host.DedicatedWorkerGlobalScope === "function" && globalThis instanceof host.DedicatedWorkerGlobalScope;
}

if (inWorker()) {
  const scope = globalThis as unknown as {
    onmessage: ((event: MessageEvent<PropagateRequest>) => void) | null;
    postMessage: (message: unknown, transfer?: Transferable[]) => void;
  };
  scope.onmessage = (event: MessageEvent<PropagateRequest>) => {
    const result = runPropagate(event.data, state);
    const positions = result.positions;
    scope.postMessage({ ...result, positions }, [positions.buffer]);
  };
}
