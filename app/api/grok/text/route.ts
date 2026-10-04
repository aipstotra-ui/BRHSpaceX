import { defaultCopilotState, type CopilotState } from "@/lib/grok/copilotState";
import { runTextFallback } from "@/lib/grok/textFallback";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "missing server key" }, { status: 500, headers: NO_STORE });
  }

  const body = (await request.json()) as { input?: string; state?: CopilotState };
  const input = typeof body.input === "string" ? body.input : "";
  const state = body.state ?? defaultCopilotState();
  const result = await runTextFallback(input, apiKey, fetch, state);
  return Response.json(result, { headers: NO_STORE });
}
