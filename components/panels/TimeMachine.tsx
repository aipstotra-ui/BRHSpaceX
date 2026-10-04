"use client";

import { useState } from "react";

import { CLIMATOLOGY_SENTENCE } from "@/lib/engine/orbit/climatology";
import { DEFAULT_ORBIT_KM, SEP_ONSET, replayOnOrbit } from "@/lib/engine/replayOnOrbit";
import { useOrbitStore } from "@/lib/store/orbit";

function mark(value: number): string {
  if (Math.abs(value) < 1e-9) {
    return "same";
  }
  return value < 0 ? "better" : "worse";
}

export function TimeMachine() {
  const chosenAltitude = useOrbitStore((state) => state.altitudeKm);
  const [scrub, setScrub] = useState(0);
  const replay = replayOnOrbit(chosenAltitude, DEFAULT_ORBIT_KM);
  const hour = replay.hours[scrub];
  return (
    <div className="body">
      <p>May 2024 replay, labeled {replay.label}. {CLIMATOLOGY_SENTENCE}</p>
      <p data-testid="sep-marker">SEP onset {SEP_ONSET}</p>
      <p data-testid="first-move">First non-continue {replay.firstNonContinue}</p>
      <label className="rok-field">
        Replay hour
        <input
          aria-label="Replay scrubber"
          type="range"
          min={0}
          max={replay.hours.length - 1}
          value={scrub}
          onChange={(event) => setScrub(Number(event.target.value))}
        />
      </label>
      {hour ? (
        <p>
          {hour.time} Kp {hour.kp === null ? "n/a" : hour.kp.toFixed(2)} {hour.gLevel} action {replay.chosen.actions[scrub]}
        </p>
      ) : null}
      <table>
        <thead>
          <tr>
            <th>Delta</th>
            <th>Chosen minus default</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Cost</td>
            <td>{replay.delta.cost.toFixed(2)}</td>
            <td>{mark(replay.delta.cost)}</td>
          </tr>
          <tr>
            <td>Downtime h</td>
            <td>{replay.delta.downtimeHours.toFixed(2)}</td>
            <td>{mark(replay.delta.downtimeHours)}</td>
          </tr>
          <tr>
            <td>Uncorrectable</td>
            <td>{replay.delta.uncorrectable.toFixed(2)}</td>
            <td>{mark(replay.delta.uncorrectable)}</td>
          </tr>
          <tr>
            <td>Dose</td>
            <td>{replay.delta.dose.toFixed(4)}</td>
            <td>{mark(replay.delta.dose)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
