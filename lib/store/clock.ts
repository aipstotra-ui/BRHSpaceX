import { useEffect } from "react";
import { create } from "zustand";

import { timelineRange, useTimelineStore } from "@/lib/store/timeline";

/** Playback speeds, simulated seconds per real second. */
export const SPEEDS = [60, 600, 3600, 21600] as const;
export type Speed = (typeof SPEEDS)[number];

export const SPEED_LABELS: Record<Speed, string> = {
  60: "1 min/s",
  600: "10 min/s",
  3600: "1 h/s",
  21600: "6 h/s",
};

/** Real-time frames longer than this (a background tab, a debugger pause) advance as if they were this long. */
const MAX_FRAME_MS = 250;

interface ClockState {
  playing: boolean;
  speed: Speed;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: Speed) => void;
}

export const useClockStore = create<ClockState>((set) => ({
  playing: false,
  speed: 600,
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
}));

/** Next simulation time after a real-time frame, and whether it reached the end. */
export function advance(simMs: number, frameMs: number, speed: number, endMs: number): { simMs: number; ended: boolean } {
  const next = simMs + Math.min(Math.max(frameMs, 0), MAX_FRAME_MS) * speed;
  return next >= endMs ? { simMs: endMs, ended: true } : { simMs: next, ended: false };
}

/** Runs the clock: while playing, moves the timeline's simulation time every animation frame. Mount once. */
export function useClockDriver(): void {
  const playing = useClockStore((state) => state.playing);

  useEffect(() => {
    if (!playing) {
      return;
    }
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const timeline = useTimelineStore.getState();
      const range = timelineRange(timeline.points);
      if (!range) {
        useClockStore.getState().setPlaying(false);
        return;
      }
      const { simMs, ended } = advance(timeline.simTimeMs, now - last, useClockStore.getState().speed, range.endMs);
      last = now;
      timeline.setSimTime(simMs);
      if (ended) {
        useClockStore.getState().setPlaying(false);
        return;
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [playing]);
}
