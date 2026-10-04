import { workletModuleUrl } from "@/lib/grok/audio-worklet";
import { readCopilotState, writeCopilotState } from "@/lib/grok/copilotState";
import { COPILOT_INSTRUCTIONS } from "@/lib/grok/instructions";
import { createPlaybackContext, PcmPlaybackQueue } from "@/lib/grok/playback";
import { executeGrokTool, GROK_TOOLS } from "@/lib/grok/tools";
import { recordToolCall } from "@/lib/grok/toolLog";

export const REALTIME_URL =
  "wss://api.x.ai/v1/realtime?model=grok-voice-think-fast-2.0";

const VOICE = "eve";

export function clientSecretProtocol(value: string): string {
  return `xai-client-secret.${value}`;
}

export function openRealtimeSocket(value: string): WebSocket {
  return new WebSocket(REALTIME_URL, [clientSecretProtocol(value)]);
}

export type VoiceMode = "vad" | "ptt";

async function readBrowserFeed(feed: string): Promise<unknown> {
  const response = await fetch(`/api/data/${feed}`);
  const body = (await response.json()) as { data?: unknown };
  if (!response.ok || body.data === undefined) {
    throw new Error(feed);
  }
  return body.data;
}

export function buildSessionUpdate(mode: VoiceMode = "vad") {
  return {
    type: "session.update" as const,
    session: {
      voice: VOICE,
      instructions: COPILOT_INSTRUCTIONS,
      turn_detection: mode === "ptt" ? null : { type: "server_vad" as const },
      audio: {
        input: { format: { type: "audio/pcm" as const, rate: 24000 } },
        output: { format: { type: "audio/pcm" as const, rate: 24000 } },
      },
      reasoning: { effort: "none" as const },
      tools: GROK_TOOLS,
    },
  };
}

export type ToolReply = {
  type: "conversation.item.create";
  item: {
    type: "function_call_output";
    call_id: string;
    output: string;
  };
};

export function toolReplyMessages(
  calls: Array<{ call_id: string; output: string }>,
): Array<ToolReply | { type: "response.create" }> {
  const outputs: ToolReply[] = calls.map((call) => ({
    type: "conversation.item.create",
    item: {
      type: "function_call_output",
      call_id: call.call_id,
      output: call.output,
    },
  }));
  return [...outputs, { type: "response.create" }];
}

export async function executeToolCall(name: string, args: unknown): Promise<string> {
  const result = await executeGrokTool(name, args, readCopilotState(), { readFeed: readBrowserFeed });
  if (result.changed) {
    writeCopilotState(result.state);
  }
  recordToolCall({ name, args, output: result.output });
  return result.output;
}

type ServerEvent = {
  type?: string;
  name?: string;
  call_id?: string;
  arguments?: string;
  delta?: string;
  transcript?: string;
};

export type RealtimeHandlers = {
  onTranscript: (text: string) => void;
  onFallback: () => void;
  send: (message: unknown) => void;
};

export function createRealtimeHandler(playback: { whenIdle: () => Promise<void> }, handlers: RealtimeHandlers) {
  const pending: Array<{ name: string; call_id: string; arguments: string }> = [];
  let assistant = "";
  let flushing = false;

  async function flush(): Promise<void> {
    if (flushing || pending.length === 0) {
      return;
    }
    flushing = true;
    const batch = pending.splice(0, pending.length);
    await playback.whenIdle();
    const prepared = [];
    for (const call of batch) {
      let args: unknown = {};
      try {
        args = JSON.parse(call.arguments || "{}") as unknown;
      } catch {
        args = {};
      }
      prepared.push({
        call_id: call.call_id,
        output: await executeToolCall(call.name, args),
      });
    }
    for (const message of toolReplyMessages(prepared)) {
      handlers.send(message);
    }
    flushing = false;
    if (pending.length > 0) {
      await flush();
    }
  }

  return {
    onEvent(event: ServerEvent) {
      if (event.type === "response.output_audio_transcript.delta" && event.delta) {
        assistant += event.delta;
        handlers.onTranscript(assistant);
      }
      if (event.type === "response.output_audio_transcript.done" && event.transcript) {
        assistant = event.transcript;
        handlers.onTranscript(assistant);
      }
      if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript) {
        handlers.onTranscript(event.transcript);
      }
      if (
        event.type === "response.function_call_arguments.done" &&
        event.name &&
        event.call_id
      ) {
        pending.push({
          name: event.name,
          call_id: event.call_id,
          arguments: event.arguments ?? "{}",
        });
      }
      if (event.type === "response.done") {
        void flush();
      }
    },
  };
}

export function startMicAndSocket(deps: {
  getUserMedia: () => Promise<MediaStream>;
  openSocket: () => WebSocket;
}): { mic: Promise<MediaStream>; socket: WebSocket } {
  const mic = deps.getUserMedia();
  const socket = deps.openSocket();
  return { mic, socket };
}

export async function connectVoice(
  handlers: {
    onTranscript: (text: string) => void;
    onFallback: () => void;
    onAudioDelta: (delta: string) => void;
  },
  options?: { mode?: VoiceMode },
): Promise<{ stop: () => void; setTalking: (talking: boolean) => void; commitInput: () => void }> {
  const tokenResponse = await fetch("/api/grok/token", {
    method: "POST",
    cache: "no-store",
  });
  if (!tokenResponse.ok) {
    handlers.onFallback();
    throw new Error("token request failed");
  }
  const token = (await tokenResponse.json()) as { value?: string };
  if (!token.value) {
    handlers.onFallback();
    throw new Error("token missing");
  }

  const mode = options?.mode ?? "vad";
  const gate = { talking: mode === "vad" };
  const playbackContext = createPlaybackContext();
  const playback = new PcmPlaybackQueue(playbackContext);
  const { mic, socket } = startMicAndSocket({
    getUserMedia: () => navigator.mediaDevices.getUserMedia({ audio: true }),
    openSocket: () => openRealtimeSocket(token.value as string),
  });

  const session = createRealtimeHandler(playback, {
    onTranscript: handlers.onTranscript,
    onFallback: handlers.onFallback,
    send: (message) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    },
  });

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify(buildSessionUpdate(mode)));
  });
  socket.addEventListener("error", () => {
    handlers.onFallback();
  });
  socket.addEventListener("message", (message) => {
    const raw = typeof message.data === "string" ? message.data : "";
    if (!raw) {
      return;
    }
    const event = JSON.parse(raw) as ServerEvent & { delta?: string };
    if (
      (event.type === "response.output_audio.delta" || event.type === "response.audio.delta") &&
      event.delta
    ) {
      playback.enqueueBase64Pcm(event.delta);
      handlers.onAudioDelta(event.delta);
    }
    session.onEvent(event);
  });

  const stream = await mic;
  await playbackContext.audioWorklet.addModule(workletModuleUrl());
  const source = playbackContext.createMediaStreamSource(stream);
  const worklet = new AudioWorkletNode(playbackContext, "pcm-downsample");
  worklet.port.onmessage = (event: MessageEvent<{ audio?: string }>) => {
    if (socket.readyState === WebSocket.OPEN && event.data.audio && gate.talking) {
      socket.send(
        JSON.stringify({
          type: "input_audio_buffer.append",
          audio: event.data.audio,
        }),
      );
    }
  };
  source.connect(worklet);

  return {
    setTalking(talking: boolean) {
      gate.talking = talking;
    },
    commitInput() {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      }
    },
    stop() {
      socket.close();
      for (const track of stream.getTracks()) {
        track.stop();
      }
      void playbackContext.close();
    },
  };
}
