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

TARGET: docs/research/api-xai.md

| Item | Value | Unit | Source URL | Accessed | Status | Note |
| --- | --- | --- | --- | --- | --- | --- |
| POST /v1/realtime/client_secrets Authorization header | `Authorization: Bearer <API key>` (examples: `Bearer $XAI_API_KEY`) | — | https://docs.x.ai/developers/model-capabilities/audio/ephemeral-tokens | 2026-10-03 | CONFIRMED | Same header on https://docs.x.ai/developers/rest-api-reference/inference/voice. WebSocket browser auth is separate: `Sec-WebSocket-Protocol: xai-client-secret.<token>`. |
| session.update client event JSON | `{"type":"session.update","session":{"voice":"<string>","instructions":"<string>","turn_detection":{"type":"server_vad"},"reasoning":{"effort":"high"\|"none"},"audio":{"input":{"format":{"type":"audio/pcm","rate":24000}},"output":{"format":{"type":"audio/pcm","rate":24000}}}}}` | — | https://docs.x.ai/voice-realtime.ws.json | 2026-10-03 | CONFIRMED | Preferred. Required keys are `type` and `session`. `reasoning.effort` is nested as `session.reasoning.effort` (default `"high"`), not a dotted key. PCM `rate` 24000 is the documented default. Schema example voice is `"Eve"` and omits `reasoning`. Guide examples use voice `"eve"` and the same audio nesting: https://docs.x.ai/docs/guides/voice/agent and https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech. Also settable at connect time as query `reasoning.effort`. |
| Append base64 PCM mic audio | Client event type `input_audio_buffer.append`. Payload field `audio` (base64 string). `{"type":"input_audio_buffer.append","audio":"<base64>"}` | — | https://docs.x.ai/voice-realtime.ws.json | 2026-10-03 | CONFIRMED | Codec is the session format (`audio/pcm`), not a field on this event. Speech-to-speech guide: with `server_vad`, append only; base64 goes in `input_audio_buffer.append` when `audio.input.transport` is `json` (default). |
| Output audio delta for playback | Server event `response.output_audio.delta`. Base64 field `delta`. | — | https://docs.x.ai/voice-realtime.ws.json | 2026-10-03 | CONFIRMED | Preferred. Voice overview decodes `event["delta"]`: https://docs.x.ai/developers/model-capabilities/audio/voice. Speech-to-speech guide also names `response.audio.delta` as the JSON transport event and does not give that alias its own field schema. |
| User transcript text | Final: `conversation.item.input_audio_transcription.completed`, field `transcript`. Live cumulative: `conversation.item.input_audio_transcription.updated`, field `transcript`. | — | https://docs.x.ai/voice-realtime.ws.json | 2026-10-03 | CONFIRMED | `updated` is only when `audio.input.transcription.model` is `grok-transcribe` (schema text). That model key is not in the `session.update` transcription properties (those list `language_hint` and `keyterms`). `conversation.item.added` can also carry `item.content[].transcript`. |
| Assistant transcript text | Streaming fragment: `response.output_audio_transcript.delta`, field `delta`. Complete text: `response.output_audio_transcript.done`, field `transcript`. | — | https://docs.x.ai/voice-realtime.ws.json | 2026-10-03 | CONFIRMED | Same event names on https://docs.x.ai/developers/rest-api-reference/inference/voice. |
| POST /v1/responses request body | `tools`: array of `{"type":"function","name","description","parameters"}` (`parameters` is a JSON Schema object). `input`: array; user turn `{"role":"user","content":"..."}`; tool result `{"type":"function_call_output","call_id","output"}` (`output` is a string in the guide). `previous_response_id`: top-level string, the prior response id, sent with the tool-result request. Function-calling guide examples use model `grok-4.7`. | — | https://docs.x.ai/docs/guides/function-calling | 2026-10-03 | CONFIRMED | Same `grok-4.7` examples at https://docs.x.ai/developers/tools/function-calling. OpenAPI https://docs.x.ai/openapi.json: `ModelRequest.tools` items are `ModelTool` (`type: "function"` plus `FunctionDefinition` `name` + `parameters`); `input` is a string or array of `ModelInputPart`; `FunctionToolCallOutput` requires `type` `function_call_output`, `call_id`, and `output` (string or array); `previous_response_id` is a nullable string. |
| /v1/responses function-call JSON path | An `output[]` item with `type` `"function_call"`. Name, call id, and arguments are on that item: `output[i].name`, `output[i].call_id`, `output[i].arguments` (JSON string). | — | https://docs.x.ai/openapi.json | 2026-10-03 | CONFIRMED | Preferred. `ModelResponse.output[]` includes `FunctionToolCall` (required `arguments`, `call_id`, `name`, `type`). Guide reads the same fields as `item.name`, `item.call_id`, `item.arguments` when `item.type == "function_call"`: https://docs.x.ai/docs/guides/function-calling. |
| /v1/responses assistant final text | `output[i].content[j].text` where `output[i].type` is `"message"` and `content[j].type` is `"output_text"`. | — | https://docs.x.ai/developers/model-capabilities/text/comparison | 2026-10-03 | CONFIRMED | OpenAPI `OutputMessage.content` text part requires `type: "output_text"` and `text`. Guide prints `item.content[0].text` for the first part. Top-level response `text` is format config, not the message. |
| POST /v1/images/generations model, response_format, base64 path | Model in examples: `grok-imagine-image-2.0`. `response_format`: `"url"` (default) or `"b64_json"`. Base64 image: `data[0].b64_json` (no data-URI prefix). | — | https://docs.x.ai/developers/rest-api-reference/inference/images | 2026-10-03 | CONFIRMED | Matches the existing api-xai.md note. OpenAPI `GenerateImageRequest.response_format` default `"url"`; `GeneratedImageResponse.data[]` / `GeneratedImage.b64_json`. Same model in https://docs.x.ai/docs/guides/image-generations. |

BLOCKING: no
