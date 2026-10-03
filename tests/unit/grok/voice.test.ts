import { afterEach, describe, expect, it, vi } from "vitest";

import {
  base64ToPcm16,
  chunkSampleCount,
  downsampleFloatToPcm16,
  pcm16ToBase64,
  PCM_RATE,
} from "@/lib/grok/audio-worklet";
import { POST as imagePost } from "@/app/api/grok/image/route";
import { POST as textPost } from "@/app/api/grok/text/route";
import { POST as tokenPost } from "@/app/api/grok/token/route";
import {
  buildSessionUpdate,
  clientSecretProtocol,
  createRealtimeHandler,
  openRealtimeSocket,
  REALTIME_URL,
  startMicAndSocket,
  toolReplyMessages,
} from "@/lib/grok/realtime";
import { runTextFallback } from "@/lib/grok/textFallback";
import { TEST_VALUE } from "@/lib/grok/testTool";
import { getToolLog, resetToolLog } from "@/lib/grok/toolLog";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.XAI_API_KEY;
  resetToolLog();
});

describe("voice session", () => {
  it("builds a browser socket and a session update without a proxy", () => {
    expect(REALTIME_URL).toBe(
      "wss://api.x.ai/v1/realtime?model=grok-voice-think-fast-2.0",
    );
    expect(clientSecretProtocol("secret")).toBe("xai-client-secret.secret");
    const sockets: unknown[][] = [];
    vi.stubGlobal(
      "WebSocket",
      class {
        constructor(...args: unknown[]) {
          sockets.push(args);
        }
      },
    );
    openRealtimeSocket("secret");
    expect(sockets[0]?.[0]).toBe(REALTIME_URL);
    expect(sockets[0]?.[1]).toEqual(["xai-client-secret.secret"]);

    const session = buildSessionUpdate();
    expect(session.session.voice).toBe("eve");
    expect(session.session.turn_detection).toEqual({ type: "server_vad" });
    expect(session.session.audio.input.format).toEqual({ type: "audio/pcm", rate: PCM_RATE });
    expect(session.session.audio.output.format).toEqual({ type: "audio/pcm", rate: PCM_RATE });
    expect(session.session.reasoning).toEqual({ effort: "none" });
    expect(session.session.tools[0]?.name).toBe("get_test_value");
    expect(JSON.stringify(session)).not.toContain("anchor");
  });

  it("starts the mic and the socket without waiting for the mic", async () => {
    let releaseMic: (stream: MediaStream) => void = () => undefined;
    const mic = new Promise<MediaStream>((resolve) => {
      releaseMic = resolve;
    });
    let opened = false;
    const { mic: pending, socket } = startMicAndSocket({
      getUserMedia: () => mic,
      openSocket: () => {
        opened = true;
        return { readyState: 0 } as WebSocket;
      },
    });
    expect(opened).toBe(true);
    expect(socket.readyState).toBe(0);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    releaseMic({} as MediaStream);
    await pending;
    expect(settled).toBe(true);
  });

  it("sends every tool output before one response.create after playback is idle", async () => {
    const sent: Array<{ type: string }> = [];
    let release: () => void = () => undefined;
    const playback = {
      whenIdle: () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    };
    const handler = createRealtimeHandler(playback, {
      onTranscript: () => undefined,
      onFallback: () => undefined,
      send: (message) => sent.push(message as { type: string }),
    });
    handler.onEvent({
      type: "response.function_call_arguments.done",
      name: "get_test_value",
      call_id: "call-a",
      arguments: "{}",
    });
    handler.onEvent({
      type: "response.function_call_arguments.done",
      name: "get_test_value",
      call_id: "call-b",
      arguments: "{}",
    });
    handler.onEvent({ type: "response.done" });
    await Promise.resolve();
    expect(sent).toEqual([]);
    release();
    await vi.waitFor(() => expect(sent).toHaveLength(3));
    expect(sent.map((message) => message.type)).toEqual([
      "conversation.item.create",
      "conversation.item.create",
      "response.create",
    ]);
    expect(getToolLog().map((entry) => entry.output)).toEqual([
      JSON.stringify({ value: TEST_VALUE.value, label: "estimate" }),
      JSON.stringify({ value: TEST_VALUE.value, label: "estimate" }),
    ]);
    const planned = toolReplyMessages([
      { call_id: "call-a", output: "1" },
      { call_id: "call-b", output: "2" },
    ]);
    expect(planned.at(-1)).toEqual({ type: "response.create" });
  });
});

describe("pcm audio", () => {
  it("downsamples to 24 kHz and chunks about every 100 ms", () => {
    expect(chunkSampleCount()).toBe(2400);
    const input = new Float32Array(4800);
    input.fill(0.5);
    const pcm = downsampleFloatToPcm16(input, 48000, PCM_RATE);
    expect(pcm.length).toBe(2400);
    expect(pcm[0]).toBeGreaterThan(0);
    const encoded = pcm16ToBase64(pcm);
    expect(base64ToPcm16(encoded)).toEqual(pcm);
  });
});

describe("grok routes", () => {
  it("requests a client secret and returns value plus expires_at with no-store", async () => {
    process.env.XAI_API_KEY = "server-key";
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return Response.json({ value: "ephemeral-a", expires_at: 123 });
      }),
    );
    const response = await tokenPost();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ value: "ephemeral-a", expires_at: 123 });
    const body = JSON.parse(String(calls[0]?.init?.body));
    expect(calls[0]?.url).toBe("https://api.x.ai/v1/realtime/client_secrets");
    expect(body).toEqual({ expires_after: { seconds: 300 } });
    expect(body.session).toBeUndefined();
    expect(body.expires_after.anchor).toBeUndefined();
    const header = new Headers(calls[0]?.init?.headers);
    expect(header.get("authorization")).toBe("Bearer server-key");
  });

  it("loops function calls on the responses endpoint and returns the spoken text", async () => {
    process.env.XAI_API_KEY = "server-key";
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        calls.push({ url, body });
        if (calls.length === 1) {
          return Response.json({
            id: "resp-1",
            output: [
              {
                type: "function_call",
                name: "get_test_value",
                call_id: "call-1",
                arguments: "{}",
              },
            ],
          });
        }
        return Response.json({
          id: "resp-2",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "The test value is 42." }],
            },
          ],
        });
      }),
    );
    const response = await textPost(
      new Request("http://local/api/grok/text", {
        method: "POST",
        body: JSON.stringify({ input: "what is the test value" }),
      }),
    );
    const payload = (await response.json()) as { text: string; tools: Array<{ output: string }> };
    expect(payload.text).toBe("The test value is 42.");
    expect(payload.tools[0]?.output).toContain('"label":"estimate"');
    expect(calls.every((call) => call.url === "https://api.x.ai/v1/responses")).toBe(true);
    expect(calls[1]?.body.previous_response_id).toBe("resp-1");
    expect(calls[1]?.body.model).toBe("grok-4.7");
    const followup = calls[1]?.body.input as Array<{ type: string }>;
    expect(followup[0]?.type).toBe("function_call_output");
  });

  it("asks for a base64 image", async () => {
    process.env.XAI_API_KEY = "server-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { model: string; response_format: string };
        expect(body.model).toBe("grok-imagine-image-2.0");
        expect(body.response_format).toBe("b64_json");
        return Response.json({ data: [{ b64_json: "aW1hZ2U=" }] });
      }),
    );
    const response = await imagePost(
      new Request("http://local/api/grok/image", {
        method: "POST",
        body: JSON.stringify({ prompt: "StarMind Nav test image" }),
      }),
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ b64_json: "aW1hZ2U=" });
  });
});

describe("text fallback helper", () => {
  it("stops when the model returns a message", async () => {
    const result = await runTextFallback("hello", "server-key", async () =>
      Response.json({
        id: "resp",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "ready" }],
          },
        ],
      }),
    );
    expect(result.text).toBe("ready");
    expect(result.tools).toEqual([]);
  });
});
