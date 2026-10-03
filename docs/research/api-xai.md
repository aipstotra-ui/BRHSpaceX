### A2 → `docs/research/api-xai.md` [Researchy A1–A16; SWE §4.2–4.3]
Sources: https://docs.x.ai/docs/guides/voice/agent ; https://docs.x.ai/developers/rest-api-reference/inference/voice ; https://docs.x.ai/developers/model-capabilities/audio/ephemeral-tokens ; https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech

**Token**
- `POST https://api.x.ai/v1/realtime/client_secrets` with body `{"expires_after":{"seconds":N}}`. Default 600 s, max 3600 s.
- Response: `{value, expires_at}`.
- Don't rely on `session` or `expires_after.anchor`.

**WebSocket**
- URL: `wss://api.x.ai/v1/realtime?model=grok-voice-think-fast-2.0`. `grok-voice-latest` is an alias; pin the versioned name.
- Protocol: `["xai-client-secret." + value]`.
- Max session 120 min.
- Never proxy it through Vercel.

**session.update**
- `voice`, `instructions`, `turn_detection:{type:"server_vad"}`.
- `audio.input.format` and `audio.output.format` = `{type:"audio/pcm",rate:24000}`.
- `reasoning.effort` defaults to `"high"`; use `"none"` for latency.

**Tool calls**
- Event `response.function_call_arguments.done` carries `{name, call_id, arguments (JSON string)}`.
- Reply with `conversation.item.create {type:"function_call_output", call_id, output}`, then `response.create`.
- Batch parallel outputs before a single `response.create`, and wait for playback to finish.
- `function_call_output` items aren't billed.

**Images** (https://docs.x.ai/developers/rest-api-reference/inference/images ; https://docs.x.ai/docs/guides/image-generations)
- `POST /v1/images/generations` with `grok-imagine-image-2.0`.
- `response_format: "url"` (default) or `"b64_json"`; the image is at `data[0].b64_json`.

**Video**
- `POST /v1/videos/generations` with `grok-imagine-video-1.5`. Duration up to 15 s. Returns a `request_id`.
- Poll `GET /v1/videos/{request_id}`. `status` is `done`/`failed`/`expired`, and the URL is at `.video.url`.

**Fallback** (https://docs.x.ai/developers/model-capabilities/text/comparison ; https://docs.x.ai/docs/guides/function-calling)
- `POST /v1/responses` with `input`, `function_call` items, and `function_call_output` + `previous_response_id`. The guide's examples use model `grok-4.7`.
- Chat Completions is deprecated.
