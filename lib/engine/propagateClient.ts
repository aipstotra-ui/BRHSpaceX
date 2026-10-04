export function createPropagateWorker(): Worker {
  return new Worker(new URL("./propagate.worker.ts", import.meta.url), { type: "module" });
}
