export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IMAGES_URL = "https://api.x.ai/v1/images/generations";
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "missing server key" }, { status: 500, headers: NO_STORE });
  }

  const body = (await request.json()) as { prompt?: string };
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const upstream = await fetch(IMAGES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-imagine-image-2.0",
      prompt,
      response_format: "b64_json",
    }),
    cache: "no-store",
  });
  const payload = (await upstream.json()) as {
    data?: Array<{ b64_json?: string }>;
  };
  const b64 = payload.data?.[0]?.b64_json ?? null;
  if (!upstream.ok || !b64) {
    return Response.json({ error: "image request failed" }, { status: 502, headers: NO_STORE });
  }
  return Response.json({ b64_json: b64 }, { headers: NO_STORE });
}
