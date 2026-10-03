export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CLIENT_SECRETS_URL = "https://api.x.ai/v1/realtime/client_secrets";

/** estimate: ephemeral token TTL. The documented maximum is 3600 s. */
const TOKEN_TTL_SECONDS = 300;

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "missing server key" }, { status: 500, headers: NO_STORE });
  }

  const upstream = await fetch(CLIENT_SECRETS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expires_after: { seconds: TOKEN_TTL_SECONDS } }),
    cache: "no-store",
  });

  const payload = (await upstream.json()) as { value?: string; expires_at?: number | string };
  if (!upstream.ok || typeof payload.value !== "string") {
    return Response.json({ error: "token request failed" }, { status: 502, headers: NO_STORE });
  }

  return Response.json(
    { value: payload.value, expires_at: payload.expires_at },
    { headers: NO_STORE },
  );
}
