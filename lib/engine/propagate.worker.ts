import { satrecFloats, satrecsFor, starlinkFloats, type GpRecord } from "@/lib/engine/globe/sgp4";
import { subsampleShellIndexes } from "@/lib/engine/globe/subsample";


/** "init" loads the snapshot; "scrub" propagates the constellation to the simulation time. Nothing ticks on its own. */
export interface WorkerIn {
  kind: "init" | "scrub";
  epochMs?: number;
  records?: GpRecord[];
}

export interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerIn>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
}

export function propagateStarlink(records: GpRecord[], epochMs: number): Float32Array {
  return starlinkFloats(records, new Date(epochMs));
}

export function selectStarlink(records: GpRecord[]): GpRecord[] {
  const indexes = subsampleShellIndexes(
    records.map((record) => ({
      inclinationDeg: record.INCLINATION,
      meanMotionRevPerDay: record.MEAN_MOTION,
    })),
  );
  return indexes.map((index) => records[index]);
}

let satrecs: ReturnType<typeof satrecsFor> = [];
let epochMs = Date.now();

function postStarlink(scope: WorkerScope) {
  const started = performance.now();
  const positions = satrecFloats(satrecs, new Date(epochMs));
  const ms = performance.now() - started;
  scope.postMessage({ kind: "starlink", positions, count: positions.length / 3, ms, epochMs }, [positions.buffer]);
}

export function handleWorkerMessage(scope: WorkerScope, data: WorkerIn) {
  if (data.kind === "init" && data.records) {
    satrecs = satrecsFor(selectStarlink(data.records));
    epochMs = data.epochMs ?? Date.now();
    postStarlink(scope);
    return;
  }
  if (data.kind === "scrub") {
    epochMs = data.epochMs ?? epochMs;
    postStarlink(scope);
  }
}

function inWorker(): boolean {
  return (globalThis as { constructor?: { name?: string } }).constructor?.name === "DedicatedWorkerGlobalScope";
}

if (inWorker()) {
  const scope = globalThis as unknown as WorkerScope;
  scope.onmessage = (event: MessageEvent<WorkerIn>) => {
    if (event.data.kind === "init" && !event.data.records) {
      const epoch = event.data.epochMs ?? Date.now();
      void fetch("/api/data/celestrak_gp")
        .then((response) => response.json())
        .then((body: { data?: GpRecord[] }) => {
          handleWorkerMessage(scope, { kind: "init", records: body.data ?? [], epochMs: epoch });
        })
        .catch((error: unknown) => {
          scope.postMessage({ kind: "error", message: error instanceof Error ? error.message : "snapshot failed" });
        });
      return;
    }
    handleWorkerMessage(scope, event.data);
  };
}

export {};
