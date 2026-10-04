"use client";

import { useEffect, useState } from "react";

import { HOHMANN_LABEL, hohmannDeltaVMs } from "@/lib/engine/orbit/hohmann";
import { ssoInclinationDeg } from "@/lib/engine/orbit/sso";
import { useOrbitStore } from "@/lib/store/orbit";

export function TransferAnimation({
  targetAltitudeKm,
  targetLtanHours,
}: {
  targetAltitudeKm: number;
  targetLtanHours: number;
}) {
  const altitudeKm = useOrbitStore((state) => state.altitudeKm);
  const setAltitudeKm = useOrbitStore((state) => state.setAltitudeKm);
  const setSunSynchronous = useOrbitStore((state) => state.setSunSynchronous);
  const setLtanHours = useOrbitStore((state) => state.setLtanHours);
  const [playing, setPlaying] = useState(false);
  const deltaVMs = hohmannDeltaVMs(altitudeKm, targetAltitudeKm);

  useEffect(() => {
    if (!playing) {
      return;
    }
    const start = useOrbitStore.getState().altitudeKm;
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / 1200);
      const next = start + (targetAltitudeKm - start) * t;
      setSunSynchronous(true);
      setAltitudeKm(t < 1 ? next : targetAltitudeKm);
      setLtanHours(targetLtanHours);
      if (t < 1) {
        frame = window.requestAnimationFrame(step);
        return;
      }
      setPlaying(false);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [playing, setAltitudeKm, setLtanHours, setSunSynchronous, targetAltitudeKm, targetLtanHours]);

  return (
    <div>
      <p className="rok-muted" data-testid="hohmann-label">
        ILLUSTRATIVE, not a maneuver plan. {HOHMANN_LABEL} Δv {(deltaVMs / 1000).toFixed(3)} km/s.
      </p>
      <button
        type="button"
        onClick={() => setPlaying(true)}
        disabled={playing}
      >
        Move Starmind to best orbit
      </button>
      <p className="rok-muted">
        Target inclination {ssoInclinationDeg(targetAltitudeKm).toFixed(2)}° is the SSO value for that altitude.
      </p>
    </div>
  );
}
