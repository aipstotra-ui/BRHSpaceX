import { defaultCopilotState, type CopilotState } from "@/lib/grok/copilotState";
import { COPILOT_INSTRUCTIONS } from "@/lib/grok/instructions";
import { readCopilotFeed } from "@/lib/grok/serverFeed";
import { executeGrokTool, GROK_TOOLS } from "@/lib/grok/tools";
import { recordToolCall, type ToolLogEntry } from "@/lib/grok/toolLog";

const RESPONSES_URL = "https://api.x.ai/v1/responses";
const TEXT_MODEL = "grok-4.7";

/** estimate: stop the tool loop if the model keeps calling tools. */
export const MAX_TOOL_ROUNDS = 8;

type JsonRecord = Record<string, unknown>;

export type TextFallbackResult = {
  text: string;
  tools: ToolLogEntry[];
  state: CopilotState;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function outputItems(payload: unknown): JsonRecord[] {
  if (!isRecord(payload) || !Array.isArray(payload.output)) {
    return [];
  }
  return payload.output.filter(isRecord);
}

function assistantText(items: JsonRecord[]): string {
  const parts: string[] = [];
  for (const item of items) {
    if (item.type !== "message" || !Array.isArray(item.content)) {
      continue;
    }
    for (const part of item.content) {
      if (isRecord(part) && part.type === "output_text" && typeof part.text === "string") {
        parts.push(part.text);
      }
    }
  }
  return parts.join("");
}

export async function runTextFallback(
  input: string,
  apiKey: string,
  doFetch: typeof fetch,
  initialState: CopilotState = defaultCopilotState(),
): Promise<TextFallbackResult> {
  const tools: ToolLogEntry[] = [];
  let state = initialState;
  let previousResponseId: string | undefined;
  let requestInput: unknown = [{ role: "user", content: input }];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const body: JsonRecord = {
      model: TEXT_MODEL,
      instructions: COPILOT_INSTRUCTIONS,
      input: requestInput,
      tools: GROK_TOOLS,
    };
    if (previousResponseId) {
      body.previous_response_id = previousResponseId;
    }

    const response = await doFetch(RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload: unknown = await response.json();
    const items = outputItems(payload);
    const calls = items.filter((item) => item.type === "function_call");
    if (calls.length === 0) {
      return { text: assistantText(items), tools, state };
    }

    const functionOutputs = [];
    for (const call of calls) {
      const name = typeof call.name === "string" ? call.name : "";
      const rawArgs = typeof call.arguments === "string" ? call.arguments : "{}";
      let args: unknown = {};
      try {
        args = JSON.parse(rawArgs) as unknown;
      } catch {
        args = {};
      }
      const result = await executeGrokTool(name, args, state, { readFeed: readCopilotFeed });
      state = result.state;
      const entry = { name, args, output: result.output };
      tools.push(entry);
      recordToolCall(entry);
      functionOutputs.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: result.output,
      });
    }

    previousResponseId = isRecord(payload) && typeof payload.id === "string" ? payload.id : undefined;
    requestInput = functionOutputs;
  }

  return { text: "", tools, state };
}
