"use client";

import { useState } from "react";

import { importDonki } from "@/lib/scenario/importDonki";
import { noaaText } from "@/lib/scenario/noaaSnapshot";
import { importNoaaKp } from "@/lib/scenario/importNoaa";
import { runScenario } from "@/lib/scenario/run";
import { scenarioSchema } from "@/lib/scenario/schema";

export function StormScenario() {
  const [speed, setSpeed] = useState("600");
  const [bz, setBz] = useState("-15");
  const [density, setDensity] = useState("20");
  const [duration, setDuration] = useState("6");
  const [arrival, setArrival] = useState("2099-01-01T00:00:00Z");
  const [error, setError] = useState<string | null>(null);
  const [kpNote, setKpNote] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof runScenario> | null>(null);

  function submit() {
    const parsed = scenarioSchema.safeParse({
      cmeSpeedKmS: Number(speed),
      bzNt: Number(bz),
      densityCm3: Number(density),
      durationH: Number(duration),
      arrivalTime: arrival,
    });
    if (!parsed.success) {
      setResult(null);
      setError(parsed.error.issues[0]?.message ?? "Invalid scenario");
      return;
    }
    setError(null);
    setKpNote(null);
    setResult(runScenario(parsed.data));
  }

  return (
    <div className="body">
      <p className="rok-badge" data-testid="scenario-banner">
        SCENARIO
      </p>
      <p>This is a what-if SCENARIO.</p>
      <label className="rok-field">
        CME speed km/s
        <input aria-label="CME speed" value={speed} onChange={(event) => setSpeed(event.target.value)} />
      </label>
      <label className="rok-field">
        Bz nT
        <input aria-label="Bz" value={bz} onChange={(event) => setBz(event.target.value)} />
      </label>
      <label className="rok-field">
        Density
        <input aria-label="Density" value={density} onChange={(event) => setDensity(event.target.value)} />
      </label>
      <label className="rok-field">
        Duration hours
        <input aria-label="Duration" value={duration} onChange={(event) => setDuration(event.target.value)} />
      </label>
      <label className="rok-field">
        Arrival time
        <input aria-label="Arrival time" value={arrival} onChange={(event) => setArrival(event.target.value)} />
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <button type="button" onClick={submit}>
          Run scenario
        </button>
        <button
          type="button"
          onClick={() => {
            const rows = importNoaaKp(noaaText);
            setKpNote(`SCENARIO from NOAA SWPC 3-day forecast, ${rows.length} Kp blocks.`);
          }}
        >
          Import NOAA
        </button>
        <button
          type="button"
          onClick={() => {
            const filled = importDonki({ speed: 800, time21_5: "2099-06-01T12:00:00Z" });
            if (filled.cmeSpeedKmS) {
              setSpeed(String(filled.cmeSpeedKmS));
            }
            if (filled.arrivalTime) {
              setArrival(filled.arrivalTime);
            }
            setKpNote("DONKI supplied speed and arrival. Enter Bz and density.");
          }}
        >
          Import DONKI
        </button>
      </div>
      {error ? <p style={{ color: "var(--status-critical)" }}>{error}</p> : null}
      {kpNote ? <p>{kpNote}</p> : null}
      {result ? (
        <p>
          SCENARIO Kp {result.kp.toFixed(1)}. Move: {result.action}.
          {result.warning ? ` ${result.warning}.` : ""}
        </p>
      ) : null}
    </div>
  );
}
