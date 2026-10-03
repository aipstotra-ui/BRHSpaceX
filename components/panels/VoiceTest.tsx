"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { SourceBadge } from "@/components/ui/SourceBadge";
import { connectVoice } from "@/lib/grok/realtime";
import { TEST_VALUE } from "@/lib/grok/testTool";
import {
  recordToolCall,
  subscribeToolLog,
  type ToolLogEntry,
} from "@/lib/grok/toolLog";

export function VoiceTest() {
  const [transcript, setTranscript] = useState("");
  const [entries, setEntries] = useState<ToolLogEntry[]>([]);
  const [fallback, setFallback] = useState(false);
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [status, setStatus] = useState("idle");
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => subscribeToolLog(setEntries), []);
  useEffect(() => () => stopRef.current?.(), []);

  async function startVoice() {
    setStatus("connecting");
    try {
      const session = await connectVoice({
        onTranscript: setTranscript,
        onFallback: () => setFallback(true),
        onAudioDelta: () => undefined,
      });
      stopRef.current = session.stop;
      setStatus("live");
    } catch {
      setFallback(true);
      setStatus("fallback");
    }
  }

  async function sendFallback() {
    setFallback(true);
    setStatus("fallback");
    const response = await fetch("/api/grok/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: draft }),
    });
    const data = (await response.json()) as {
      text?: string;
      tools?: ToolLogEntry[];
    };
    for (const tool of data.tools ?? []) {
      recordToolCall(tool);
    }
    const spoken = data.text ?? "";
    setTranscript(spoken);
    if (spoken && typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(spoken));
    }
  }

  async function imagine() {
    const response = await fetch("/api/grok/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "StarMind Nav test image" }),
    });
    const data = (await response.json()) as { b64_json?: string };
    if (data.b64_json) {
      setImage(data.b64_json);
    }
  }

  return (
    <section className="rok-panel" aria-labelledby="voice-test">
      <p className="eyebrow rok-panel__eyebrow">Voice</p>
      <h2 id="voice-test" className="heading-md rok-panel__title">
        Grok Voice
      </h2>
      <p className="body">
        Test value {TEST_VALUE.value} <SourceBadge label={TEST_VALUE.label} />
      </p>
      {fallback ? <p className="rok-badge eyebrow">fallback mode</p> : null}
      <p className="body rok-muted">Status {status}</p>
      <p className="body" data-testid="transcript">
        {transcript || "Transcript empty"}
      </p>
      <ul>
        {entries.map((entry, index) => (
          <li key={`${entry.name}-${index}`} className="body-sm data-sm">
            {entry.name} {JSON.stringify(entry.args)} {entry.output}
          </li>
        ))}
      </ul>
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <button type="button" className="rok-btn" onClick={() => void startVoice()}>
          Start voice
        </button>
        <button type="button" className="rok-btn rok-btn--ghost" onClick={() => void imagine()}>
          Imagine
        </button>
      </div>
      <label className="rok-field" style={{ marginTop: "var(--space-4)" }}>
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
      {image ? (
        <div style={{ position: "relative", width: "100%", aspectRatio: "1" }}>
          <Image alt="Generated test" src={`data:image/png;base64,${image}`} fill unoptimized />
        </div>
      ) : null}
    </section>
  );
}
