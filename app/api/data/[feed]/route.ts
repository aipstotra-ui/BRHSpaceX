import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  FEED_CACHE_SECONDS,
  isFeedId,
  isSnapshotOnly,
  LIVE_FEEDS,
  normalizeFeed,
  type FeedId,
} from "@/lib/data/swpc";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ feed: string }> };

async function readSnapshot(feed: FeedId): Promise<unknown> {
  const filePath = path.join(process.cwd(), "data", "snapshots", `${feed}.json`);
  const text = await readFile(filePath, "utf8");
  return normalizeFeed(feed, JSON.parse(text) as unknown);
}

async function readLive(feed: FeedId): Promise<unknown> {
  if (isSnapshotOnly(feed)) {
    throw new Error("snapshot only");
  }
  const url = LIVE_FEEDS[feed];
  const response = await fetch(url, {
    signal: AbortSignal.timeout(5_000),
    next: { revalidate: FEED_CACHE_SECONDS },
  });
  if (!response.ok) {
    throw new Error("live feed failed");
  }
  const payload = feed === "forecast_3day" ? { text: await response.text() } : await response.json();
  return normalizeFeed(feed, payload);
}

export async function GET(_request: Request, context: RouteContext) {
  const { feed } = await context.params;
  if (!isFeedId(feed)) {
    return Response.json({ error: "unknown feed" }, { status: 404 });
  }

  const headers = { "Cache-Control": `public, max-age=${FEED_CACHE_SECONDS}` };
  if (!isSnapshotOnly(feed)) {
    try {
      const data = await readLive(feed);
      return Response.json({ source: "live", data }, { headers });
    } catch {
      // Fall through to the snapshot.
    }
  }

  try {
    const data = await readSnapshot(feed);
    return Response.json({ source: "snapshot", data }, { headers });
  } catch {
    return Response.json({ source: "snapshot", error: "missing snapshot" }, { status: 502, headers });
  }
}
