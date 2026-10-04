import { starlinkFloats, type GpRecord } from "@/lib/engine/globe/sgp4";
import { subsampleShellIndexes } from "@/lib/engine/globe/subsample";
import { ORBIT_DEBOUNCE_MS, STARLINK_TICK_MS } from "@/lib/engine/globe/timing";
import { starmindTrail, type StarmindSample } from "@/lib/engine/globe/trail";
import { starmindPositionKm, type StarmindFix } from "@/lib/engine/orbit/j2";

export { ORBIT_DEBOUNCE_MS, STARLINK_TICK_MS };

export interface WorkerIn {
  kind: "init" | "scrub" | "starmind";
  epochMs?: number;
  altitudeKm?: number;
  inclinationDeg?: number;
  raanDeg?: number;
  records?: GpRecord[];
}

export interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerIn>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
}

export function starmindNow(
  altitudeKm: number,
  inclinationDeg: number,
  raanDeg: number,
  epochMs: number,
): StarmindFix {
  return starmindPositionKm(altitudeKm, inclinationDeg, raanDeg, epochMs / 1000);
}

export function propagateStarlink(records: GpRecord[], epochMs: number): Float32Array {
  return starlinkFloats(records, new Date(epochMs));
}

export function propagateStarmindTrail(
  altitudeKm: number,
  inclinationDeg: number,
  raanDeg: number,
  epochMs: number,
): StarmindSample[] {
  return starmindTrail(altitudeKm, inclinationDeg, raanDeg, epochMs / 1000);
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

let selected: GpRecord[] = [];
let epochMs = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;

function postStarlink(scope: WorkerScope) {
  const started = performance.now();
  const positions = propagateStarlink(selected, epochMs);
  const ms = performance.now() - started;
  scope.postMessage({ kind: "starlink", positions, count: positions.length / 3, ms }, [positions.buffer]);
}

export function handleWorkerMessage(scope: WorkerScope, data: WorkerIn) {
  if (data.kind === "init" && data.records) {
    selected = selectStarlink(data.records);
    epochMs = data.epochMs ?? Date.now();
    postStarlink(scope);
    if (timer) {
      clearInterval(timer);
    }
    timer = setInterval(() => {
      epochMs += STARLINK_TICK_MS;
      postStarlink(scope);
    }, STARLINK_TICK_MS);
    return;
  }
  if (data.kind === "scrub") {
    epochMs = data.epochMs ?? epochMs;
    postStarlink(scope);
    return;
  }
  if (data.kind === "starmind") {
    const started = performance.now();
    const trail = propagateStarmindTrail(
      data.altitudeKm ?? 0,
      data.inclinationDeg ?? 0,
      data.raanDeg ?? 0,
      data.epochMs ?? epochMs,
    );
    const now = starmindNow(data.altitudeKm ?? 0, data.inclinationDeg ?? 0, data.raanDeg ?? 0, data.epochMs ?? epochMs);
    scope.postMessage({
      kind: "starmind",
      trail,
      now,
      ms: performance.now() - started,
    });
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
