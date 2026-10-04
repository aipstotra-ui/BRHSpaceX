"use client";

import { useMemo, useState } from "react";

import { Copilot } from "@/components/panels/Copilot";
import { Globe } from "@/components/globe/Globe";
import { orbitImpact } from "@/lib/engine/orbitImpact";
import { rankOrbits } from "@/lib/engine/orbit/optimizer";
import {
  HISTORY_END,
  HISTORY_START,
  levelsFor,
  periodLabel,
  safetyReading,
  severeShare,
  type MissionWindow,
  type TimeChoice,
} from "@/lib/demo/safety";
import { getPreset } from "@/lib/presets";
import { useShellStore } from "@/lib/store";
import { useOrbitStore } from "@/lib/store/orbit";

const WORDS = ["Past", "Now", "Mission"] as const;

export function JudgeDemo() {
  const altitudeKm = useOrbitStore((state) => state.altitudeKm);
  const inclinationDeg = useOrbitStore((state) => state.inclinationDeg);
  const sunSynchronous = useOrbitStore((state) => state.sunSynchronous);
  const ltanHours = useOrbitStore((state) => state.ltanHours);
  const raanDeg = useOrbitStore((state) => state.raanDeg);
  const vehicle = useOrbitStore((state) => state.vehicle);
  const setAltitudeKm = useOrbitStore((state) => state.setAltitudeKm);
  const spec = useShellStore((state) => state.spec);
  const payload = useShellStore((state) => state.payload);
  const presetId = useShellStore((state) => state.presetId);
  const [choice, setChoice] = useState<TimeChoice>({ kind: "now" });
  const [busy, setBusy] = useState(false);
  const [moved, setMoved] = useState<{ fromKm: number; fromScore: number; toKm: number } | null>(null);

  const reading = useMemo(() => {
    const impact = orbitImpact({
      altitudeKm,
      inclinationDeg,
      sunSynchronous,
      ltanHours,
      raanDeg,
      vehicle,
      spec,
      payload,
    });
    const safety = safetyReading({
      saa: impact.saaFraction.mid,
      eclipse: impact.eclipseFraction.mid,
      thermalMarginC: impact.thermalMarginC.mid,
      lifetimeYears: impact.lifetimeYears.mid,
      severeShare: severeShare(levelsFor(choice)),
    });
    const limit =
      impact.binding === "drag"
        ? "Air drag pulls it down first."
        : impact.binding === "TID"
          ? "Radiation dose ends the mission first."
          : "Radiation dose and air drag wear it down together.";
    return { safety, limit };
  }, [altitudeKm, choice, inclinationDeg, ltanHours, payload, raanDeg, spec, sunSynchronous, vehicle]);

  const color =
    reading.safety.word === "Safe" ? "#0c9a55" : reading.safety.word === "Watch" ? "#e39b00" : "#e11d48";

  function findSafest() {
    const beforeScore = reading.safety.score;
    const beforeKm = altitudeKm;
    setBusy(true);
    window.setTimeout(() => {
      const preset = getPreset(presetId);
      const ranked = rankOrbits({
        spec,
        payload,
        vehicle,
        fromAltitudeKm: beforeKm,
        memoryUnit: preset.memoryUnit,
        nodeKnown: preset.nodeKnown,
      });
      const best = ranked[0];
      if (best) {
        const orbit = useOrbitStore.getState();
        orbit.setSunSynchronous(true);
        orbit.setLtanHours(best.ltanHours);
        orbit.setAltitudeKm(best.altitudeKm);
        setMoved({ fromKm: beforeKm, fromScore: beforeScore, toKm: best.altitudeKm });
      }
      setBusy(false);
    }, 30);
  }

  return (
    <div className="demo-page">
      <header className="demo-header">
        <div>
          <p className="demo-mark">StarMind Nav</p>
          <p className="demo-lead">See how safe this satellite is, then move it to a calmer orbit.</p>
        </div>
      </header>
      <div className="demo-stage">
        <section className="demo-earth" aria-label="Earth">
          <Globe presentation />
          <div className="demo-legend">
            <span>
              <i className="demo-dot" style={{ background: "#ffd23a" }} /> Calm orbit
            </span>
            <span>
              <i className="demo-dot" style={{ background: "#3ddc97" }} /> Auroral glow
            </span>
            <span>
              <i className="demo-dot" style={{ background: "#e0a100" }} /> Radiation belt
            </span>
            <span>
              <i className="demo-dot" style={{ background: "#e23b3b" }} /> South Atlantic zone
            </span>
          </div>
        </section>
        <section className="demo-card" aria-labelledby="safety-heading">
          <p className="demo-kicker" id="safety-heading">
            Safety score
          </p>
          <p className="demo-score" data-testid="safety-score" style={{ color }}>
            {reading.safety.score}
          </p>
          <p className="demo-word" data-testid="safety-word" style={{ color }}>
            {reading.safety.word}
          </p>
          <p className="demo-period">{periodLabel(choice)}</p>
          <p className="demo-period">
            Orbit {altitudeKm.toFixed(0)} km. {reading.limit}
          </p>
          <div className="demo-pills" role="group" aria-label="Time period">
            {WORDS.map((label) => {
              const pressed =
                (label === "Past" && choice.kind === "past") ||
                (label === "Now" && choice.kind === "now") ||
                (label === "Mission" && choice.kind === "mission");
              return (
                <button
                  key={label}
                  type="button"
                  className="demo-pill"
                  aria-pressed={pressed}
                  onClick={() => {
                    if (label === "Past") {
                      setChoice({ kind: "past", year: 2003 });
                    } else if (label === "Mission") {
                      setChoice({ kind: "mission", window: "stormy" });
                    } else {
                      setChoice({ kind: "now" });
                    }
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {choice.kind === "past" ? (
            <label className="demo-period">
              Year {choice.year}
              <input
                className="demo-slider"
                aria-label="Year"
                type="range"
                min={HISTORY_START}
                max={HISTORY_END}
                value={choice.year}
                onChange={(event) => setChoice({ kind: "past", year: Number(event.target.value) })}
              />
            </label>
          ) : null}
          {choice.kind === "mission" ? (
            <div className="demo-pills">
              {(
                [
                  ["quiet", "Quiet Sun"],
                  ["stormy", "Stormy Sun"],
                  ["cycle", "11-year cycle"],
                ] as const
              ).map(([window, label]) => (
                <button
                  key={window}
                  type="button"
                  className="demo-pill"
                  aria-pressed={choice.window === window}
                  onClick={() => setChoice({ kind: "mission", window: window as MissionWindow })}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          <label className="demo-period">
            Height {altitudeKm.toFixed(0)} km
            <input
              className="demo-slider"
              aria-label="Altitude"
              type="range"
              min={400}
              max={2000}
              step={1}
              value={altitudeKm}
              onChange={(event) => setAltitudeKm(Number(event.target.value))}
            />
          </label>
          <div className="demo-actions">
            <button type="button" className="demo-find" onClick={findSafest} disabled={busy}>
              {busy ? "Looking…" : "Find the safest orbit"}
            </button>
          </div>
          {moved ? (
            <p className="demo-compare" data-testid="orbit-move">
              Moved from {moved.fromKm.toFixed(0)} km (score {moved.fromScore}) to {moved.toKm.toFixed(0)} km.
            </p>
          ) : null}
          <ul className="demo-reasons">
            {reading.safety.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <p className="demo-note">
            Measured storms run from {HISTORY_START} to {HISTORY_END}. A longer look ahead reuses that pattern. It is
            not a forecast of a future day. The next day is what the voice forecast can speak.
          </p>
        </section>
      </div>
      <div className="demo-voice">
        <Copilot />
      </div>
    </div>
  );
}
