import { useEffect, useMemo, useState } from "react";
import type { EvalResult, MissionConfig, PhysicsClient, Track } from "./types";

export interface EngineState {
  status: "idle" | "loading" | "ready" | "error";
  result: EvalResult | null;
  track: Track | null;
  error: string | null;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Calls the host's {@link PhysicsClient}. The previous result stays in place
 * while a new request is in flight so a slider drag does not blank the panel.
 */
export function useEngineData(
  client: PhysicsClient,
  config: MissionConfig,
  options?: { debounceMs?: number; enabled?: boolean },
): EngineState {
  const delay = options?.debounceMs ?? 350;
  const enabled = options?.enabled !== false;
  const key = JSON.stringify(config);
  const debouncedKey = useDebounced(key, delay);
  const debounced = useMemo(
    () => JSON.parse(debouncedKey) as MissionConfig,
    [debouncedKey],
  );
  const [state, setState] = useState<EngineState>({
    status: "idle",
    result: null,
    track: null,
    error: null,
  });

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    setState((current) => ({ ...current, status: "loading", error: null }));
    (async () => {
      try {
        const result = await client.evaluate(debounced, controller.signal);
        const track = client.track
          ? await client.track(debounced, controller.signal)
          : null;
        if (controller.signal.aborted) return;
        setState({ status: "ready", result, track, error: null });
      } catch (error) {
        if (controller.signal.aborted || isAbort(error)) return;
        setState((current) => ({
          ...current,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    })();
    return () => controller.abort();
  }, [client, debounced, enabled]);

  return state;
}
