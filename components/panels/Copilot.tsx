"use client";

import { useEffect, useRef, useState } from "react";

import { readCopilotState, writeCopilotState, type CopilotState } from "@/lib/grok/copilotState";
import { connectVoice, type VoiceMode } from "@/lib/grok/realtime";
import { recordToolCall, subscribeToolLog, type ToolLogEntry } from "@/lib/grok/toolLog";

const MUTATING = new Set(["set_orbit", "set_chip_spec"]);

export function Copilot() {
  const [transcript, setTranscript] = useState("");
  const [entries, setEntries] = useState<ToolLogEntry[]>([]);
  const [fallback, setFallback] = useState(false);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("idle");
  const [mode, setMode] = useState<VoiceMode>("vad");
  const [talking, setTalking] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const talkingRef = useRef<((value: boolean) => void) | null>(null);
  const commitRef = useRef<(() => void) | null>(null);

  useEffect(() => subscribeToolLog(setEntries), []);
  useEffect(() => () => stopRef.current?.(), []);

  async function startVoice() {
    setStatus("connecting");
    try {
      const session = await connectVoice(
        {
          onTranscript: setTranscript,
          onFallback: () => setFallback(true),
          onAudioDelta: () => undefined,
        },
        { mode },
      );
      stopRef.current = session.stop;
      talkingRef.current = session.setTalking;
      commitRef.current = session.commitInput;
      setStatus("live");
    } catch {
      setFallback(true);
      setStatus("fallback");
    }
  }

  function hold(next: boolean) {
    setTalking(next);
    talkingRef.current?.(next);
    if (!next) {
      commitRef.current?.();
    }
  }

  async function sendFallback() {
    setFallback(true);
    setStatus("fallback");
    const state = readCopilotState();
    const response = await fetch("/api/grok/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: draft, state }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      text?: string;
      tools?: ToolLogEntry[];
      state?: CopilotState;
      error?: string;
    };
    if (!response.ok) {
      setStatus("error");
      setTranscript(
        data.error === "missing server key"
          ? "Copilot is unavailable: the server has no xAI API key (XAI_API_KEY)."
          : `Copilot request failed (${response.status}${data.error ? `: ${data.error}` : ""}).`,
      );
      return;
    }
    for (const tool of data.tools ?? []) {
      recordToolCall(tool);
    }
    if (data.state && (data.tools ?? []).some((tool) => MUTATING.has(tool.name))) {
      writeCopilotState(data.state);
    }
    const spoken = data.text ?? "";
    setTranscript(spoken);
    if (spoken && typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(spoken));
    }
  }

  return (
    <section className="rok-panel" aria-labelledby="copilot">
      <p className="eyebrow rok-panel__eyebrow">Voice</p>
      <h2 id="copilot" className="heading-md rok-panel__title">
        Copilot
      </h2>
      <p className="body">Ask for the forecast, a move, a ranked orbit, or a storm scenario. Spoken numbers come from tool calls.</p>
      {fallback ? (
        <p className="rok-badge eyebrow" data-testid="fallback-badge">
          fallback mode
        </p>
      ) : null}
      <p className="body rok-muted">Status {status}</p>
      <div className="row">
        <button
          type="button"
          className="rok-btn"
          aria-pressed={mode === "vad"}
          onClick={() => setMode("vad")}
        >
          Voice activity
        </button>
        <button
          type="button"
          className="rok-btn rok-btn--ghost"
          aria-pressed={mode === "ptt"}
          onClick={() => setMode("ptt")}
        >
          Push to talk
        </button>
      </div>
      <p className="body" data-testid="transcript">
        {transcript || "Transcript empty"}
      </p>
      <ul data-testid="tool-log">
        {entries.map((entry, index) => (
          <li key={`${entry.name}-${index}`} className="body-sm data-sm">
            {entry.name} {JSON.stringify(entry.args)} {entry.output}
          </li>
        ))}
      </ul>
      <div className="row">
        <button type="button" className="rok-btn" onClick={() => void startVoice()}>
          Start voice
        </button>
        {mode === "ptt" ? (
          <button
            type="button"
            className="rok-btn rok-btn--ghost"
            aria-pressed={talking}
            onPointerDown={() => hold(true)}
            onPointerUp={() => hold(false)}
            onPointerLeave={() => {
              if (talking) {
                hold(false);
              }
            }}
          >
            Hold to talk
          </button>
        ) : null}
      </div>
      <label className="rok-field space-above">
        <span className="rok-field__label eyebrow">Fallback text</span>
        <input
          className="rok-field__input body"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      <button type="button" className="rok-btn rok-btn--ghost" onClick={() => void sendFallback()}>
        Speak fallback
      </button>
    </section>
  );
}
