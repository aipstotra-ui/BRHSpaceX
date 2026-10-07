"use client";

import { useMemo } from "react";

import { AiPolicyReplay } from "@/components/panels/AiPolicyReplay";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { CLIMATOLOGY_SENTENCE } from "@/lib/engine/orbit/climatology";
import { DEFAULT_ORBIT_INC_DEG, DEFAULT_ORBIT_KM, replayOnOrbit } from "@/lib/engine/replayOnOrbit";
import { DEFAULT_EVENT_ID, eventById, eventForMode } from "@/lib/events/registry";
import { useOrbitStore } from "@/lib/store/orbit";
import { useTimelineStore } from "@/lib/store/timeline";

function mark(value: number): string {
  if (Math.abs(value) < 1e-9) {
    return "same";
  }
  return value < 0 ? "better" : "worse";
}

export function TimeMachine() {
  const altitudeKm = useOrbitStore((state) => state.altitudeKm);
  const inclinationDeg = useOrbitStore((state) => state.inclinationDeg);
  const mode = useTimelineStore((state) => state.mode);
  const index = useTimelineStore((state) => state.index);
  const setMode = useTimelineStore((state) => state.setMode);
  const setIndex = useTimelineStore((state) => state.setIndex);
  // The replay follows the event on the timeline; in "now" mode it shows the default event.
  const event = eventForMode(mode) ?? eventById(DEFAULT_EVENT_ID);
  const replay = useMemo(
    () =>
      replayOnOrbit(
        { altitudeKm, inclinationDeg },
        { altitudeKm: DEFAULT_ORBIT_KM, inclinationDeg: DEFAULT_ORBIT_INC_DEG },
        event.id,
      ),
    [altitudeKm, inclinationDeg, event.id],
  );
  const scrub = mode === event.id ? index : 0;
  const sepOnset = event.markers.find((marker) => marker.kind === "sep")?.time ?? null;
  const hour = replay.hours[scrub];
  const onDefault =
    Math.abs(altitudeKm - DEFAULT_ORBIT_KM) < 1e-6 && Math.abs(inclinationDeg - DEFAULT_ORBIT_INC_DEG) < 1e-6;

  const rows: [string, number, number, string][] = [
    ["Cost", replay.delta.cost, 2, ""],
    ["Downtime", replay.delta.downtimeHours, 2, "h"],
    ["Uncorrectable", replay.delta.uncorrectable, 2, ""],
    ["Trapped dose", replay.delta.dose, 3, "rad(Si)"],
  ];

  return (
    <div className="body stack stack--tight">
      <p>
        {event.title} replay ({event.dates}), labeled {replay.label}. {CLIMATOLOGY_SENTENCE}
      </p>
      {sepOnset ? <p data-testid="sep-marker">SEP onset {sepOnset}</p> : null}
      <p data-testid="first-move">First non-continue {replay.firstNonContinue ?? "none"}</p>
      <label className="rok-field">
        <span className="rok-field__label eyebrow">Replay hour</span>
        <input
          aria-label="Replay scrubber"
          type="range"
          min={0}
          max={replay.hours.length - 1}
          value={scrub}
          onChange={(change) => {
            if (useTimelineStore.getState().mode !== event.id) {
              setMode(event.id);
            }
            // The timeline loads replay points on the next tick; set the hour after it does.
            const next = Number(change.target.value);
            window.setTimeout(() => setIndex(next), 0);
          }}
        />
      </label>
      {hour ? (
        <p className="data-sm">
          {hour.time} Kp {hour.kp === null ? "n/a" : hour.kp.toFixed(2)} {hour.gLevel} · protons{" "}
          {hour.goesProtonFlux == null ? "n/a" : `${hour.goesProtonFlux.toFixed(1)} pfu`} · action{" "}
          <strong>{replay.chosen.actions[scrub]}</strong>
        </p>
      ) : null}
      {onDefault ? (
        <p className="note">
          The chosen orbit is the default orbit, so every delta is zero. Move the orbit to compare.
        </p>
      ) : null}
      <div className="table-scroll">
        <table className="rok-table">
          <caption className="sr-only">Chosen orbit minus default orbit over the replay</caption>
          <thead>
            <tr>
              <th scope="col">Delta</th>
              <th scope="col" className="rok-num">
                Chosen minus default
              </th>
              <th scope="col">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([title, value, digits, unit]) => (
              <tr key={title}>
                <th scope="row">{title}</th>
                <td className="rok-num">
                  <span className="num">
                    {value.toFixed(digits)}
                    {unit ? <span className="num__unit"> {unit}</span> : null} <SourceBadge label="estimate" />
                  </span>
                </td>
                <td>{mark(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AiPolicyReplay
        event={event}
        hours={replay.hours}
        amounts={replay.chosen.amounts}
        hindsight={replay.chosen.actions}
        hindsightCost={replay.chosen.cost}
        hindsightDowntime={replay.chosen.downtimeHours}
        cursor={scrub}
      />
      <ul className="note notes-list">
        {replay.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}
