"use client";

import { useEffect } from "react";
import { create } from "zustand";

import { orbitImpact, type OrbitImpactResult } from "@/lib/engine/orbitImpact";
import { getPreset } from "@/lib/presets";
import { useShellStore } from "@/lib/store";
import { useOrbitStore } from "@/lib/store/orbit";

export type ImpactPhase = "loading" | "error" | "empty" | "ready";

interface ImpactState {
  phase: ImpactPhase;
  result: OrbitImpactResult | null;
  workerMs: number | null;
}

/** One orbit-impact result shared by the summary and the Orbit Impact panel. */
export const useImpactStore = create<ImpactState>(() => ({
  phase: "loading",
  result: null,
  workerMs: null,
}));

/** Mount once. Recomputes the orbit impact in a worker whenever the orbit or chip changes. */
export function useOrbitImpactRunner() {
  const altitudeKm = useOrbitStore((state) => state.altitudeKm);
  const inclinationDeg = useOrbitStore((state) => state.inclinationDeg);
  const sunSynchronous = useOrbitStore((state) => state.sunSynchronous);
  const ltanHours = useOrbitStore((state) => state.ltanHours);
  const raanDeg = useOrbitStore((state) => state.raanDeg);
  const vehicle = useOrbitStore((state) => state.vehicle);
  const presetId = useShellStore((state) => state.presetId);
  const spec = useShellStore((state) => state.spec);
  const payload = useShellStore((state) => state.payload);

  const vehicleKey = JSON.stringify(vehicle);
  const specKey = JSON.stringify(spec);
  const payloadKey = JSON.stringify(payload);

  useEffect(() => {
    if (!(altitudeKm > 0)) {
      useImpactStore.setState({ phase: "empty" });
      return;
    }
    let cancelled = false;
    let worker: Worker | null = null;
    const job = window.setTimeout(() => {
      useImpactStore.setState({ phase: "loading" });
      const chip = getPreset(presetId);
      const input = {
        altitudeKm,
        inclinationDeg,
        sunSynchronous,
        ltanHours,
        raanDeg,
        vehicle: JSON.parse(vehicleKey) as typeof vehicle,
        spec: JSON.parse(specKey) as typeof spec,
        payload: JSON.parse(payloadKey) as typeof payload,
        memoryUnit: chip.memoryUnit,
        nodeKnown: chip.nodeKnown,
        deviceSeu: chip.deviceSeu,
      };
      const apply = (next: OrbitImpactResult, ms: number) => {
        if (!cancelled) {
          useImpactStore.setState({ phase: "ready", result: next, workerMs: ms });
        }
      };
      const fail = () => {
        if (!cancelled) {
          useImpactStore.setState({ phase: "error" });
        }
      };
      try {
        worker = new Worker(new URL("../../lib/engine/orbit.worker.ts", import.meta.url));
        worker.onmessage = (event: MessageEvent<{ id: number; ok: boolean; result?: OrbitImpactResult; ms?: number }>) => {
          if (event.data.id !== 1 || cancelled) {
            return;
          }
          if (!event.data.ok || !event.data.result || event.data.ms === undefined) {
            fail();
            return;
          }
          apply(event.data.result, event.data.ms);
        };
        worker.onerror = () => fail();
        worker.postMessage({ id: 1, input });
      } catch {
        try {
          const next = orbitImpact(input);
          apply(next, next.environmentMs);
        } catch {
          fail();
        }
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(job);
      worker?.terminate();
    };
  }, [altitudeKm, inclinationDeg, sunSynchronous, ltanHours, raanDeg, vehicleKey, specKey, payloadKey, presetId, vehicle, spec, payload]);
}
