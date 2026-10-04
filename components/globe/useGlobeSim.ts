"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  createPropagateState,
  ORBIT_REDRAW_DEBOUNCE_MS,
  PROPAGATE_HZ,
  runPropagate,
  starmindAt,
  starmindTrail,
  type StarmindSample,
  type TrailSample,
} from "@/lib/engine/propagate";
import { createPropagateWorker } from "@/lib/engine/propagate.worker";
import type { OrbitRequest } from "@/lib/engine/orbit/elements";
import { starlinkRecords } from "@/lib/globe/starlinkDemo";
import { useOrbitStore } from "@/lib/store/orbit";

/** Scrub window. An estimate. */
export const SCRUB_WINDOW_S = 6 * 60 * 60;
/** Playback rate versus real time. An estimate. */
export const PLAYBACK_RATE = 480;

export interface GlobeSample {
  starmind: StarmindSample | null;
  trail: TrailSample[];
  starlink: Float32Array | null;
  workerMs: number | null;
}

export function useGlobeSim() {
  const altitudeKm = useOrbitStore((state) => state.altitudeKm);
  const inclinationDeg = useOrbitStore((state) => state.inclinationDeg);
  const sunSynchronous = useOrbitStore((state) => state.sunSynchronous);
  const ltanHours = useOrbitStore((state) => state.ltanHours);
  const raanDeg = useOrbitStore((state) => state.raanDeg);
  const liveOrbit = useMemo<OrbitRequest>(
    () => ({ altitudeKm, inclinationDeg, sunSynchronous, ltanHours, raanDeg }),
    [altitudeKm, inclinationDeg, ltanHours, raanDeg, sunSynchronous],
  );
  const orbitRef = useRef(liveOrbit);
  const sampleRef = useRef<GlobeSample>({ starmind: null, trail: [], starlink: null, workerMs: null });
  const clockRef = useRef({ originMs: 0, agoS: 0, playing: false });
  const [agoS, setAgoS] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [drawnAltitudeKm, setDrawnAltitudeKm] = useState(altitudeKm);
  const [propagator, setPropagator] = useState<"worker" | "main">("worker");
  const [workerMs, setWorkerMs] = useState<number | null>(null);

  useEffect(() => {
    clockRef.current.originMs = Date.now();
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      orbitRef.current = liveOrbit;
      setDrawnAltitudeKm(liveOrbit.altitudeKm);
    }, ORBIT_REDRAW_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [liveOrbit]);

  useEffect(() => {
    const records = starlinkRecords();
    const state = createPropagateState();
    let worker: Worker | null = null;
    let usingWorker = false;
    let stopped = false;
    try {
      worker = createPropagateWorker();
      usingWorker = true;
    } catch {
      usingWorker = false;
      queueMicrotask(() => {
        if (!stopped) {
          setPropagator("main");
        }
      });
    }
    let sentRecords = false;
    const publish = (positions: Float32Array, ms: number) => {
      const copy = new Float32Array(positions.length);
      copy.set(positions);
      sampleRef.current.starlink = copy;
      sampleRef.current.workerMs = ms;
    };
    const post = () => {
      if (stopped) {
        return;
      }
      const epochMs = Date.now() - clockRef.current.agoS * 1000;
      const request = {
        epochMs,
        originMs: clockRef.current.originMs || epochMs,
        orbit: orbitRef.current,
        records: sentRecords ? undefined : records,
      };
      sentRecords = true;
      if (usingWorker && worker) {
        worker.postMessage(request);
        return;
      }
      const result = runPropagate(request, state);
      publish(result.positions, result.ms);
    };
    if (worker) {
      worker.onmessage = (event: MessageEvent<{ positions: Float32Array; ms: number }>) => {
        publish(event.data.positions, event.data.ms);
      };
      worker.onerror = () => {
        usingWorker = false;
        sentRecords = false;
        setPropagator("main");
      };
    }
    post();
    const timer = window.setInterval(post, 1000 / PROPAGATE_HZ);
    let last = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (clockRef.current.playing) {
        const next = clockRef.current.agoS - dt * PLAYBACK_RATE;
        clockRef.current.agoS = Math.max(0, Math.min(SCRUB_WINDOW_S, next));
      }
      const origin = clockRef.current.originMs || Date.now();
      const epochMs = Date.now() - clockRef.current.agoS * 1000;
      const seconds = (epochMs - origin) / 1000;
      sampleRef.current.starmind = starmindAt(orbitRef.current, seconds);
      sampleRef.current.trail = starmindTrail(orbitRef.current, seconds);
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    const label = window.setInterval(() => {
      setAgoS(clockRef.current.agoS);
      setWorkerMs(sampleRef.current.workerMs);
    }, 250);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.clearInterval(label);
      window.cancelAnimationFrame(frame);
      worker?.terminate();
    };
  }, []);

  function scrub(secondsAgo: number) {
    const next = Math.max(0, Math.min(SCRUB_WINDOW_S, secondsAgo));
    clockRef.current.agoS = next;
    clockRef.current.playing = false;
    setPlaying(false);
    setAgoS(next);
  }

  function togglePlay() {
    clockRef.current.playing = !clockRef.current.playing;
    setPlaying(clockRef.current.playing);
  }

  return {
    altitudeKm,
    sampleRef,
    agoS,
    playing,
    drawnAltitudeKm,
    propagator,
    workerMs,
    scrub,
    togglePlay,
  };
}
