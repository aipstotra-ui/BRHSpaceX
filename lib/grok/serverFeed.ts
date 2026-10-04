import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  isFeedId,
  isSnapshotOnly,
  LIVE_FEEDS,
  normalizeFeed,
  type FeedId,
} from "@/lib/data/swpc";

export async function readCopilotFeed(feed: string): Promise<unknown> {
  if (!isFeedId(feed)) {
    throw new Error("unknown feed");
  }
  if (!isSnapshotOnly(feed)) {
    try {
      const response = await fetch(LIVE_FEEDS[feed], { signal: AbortSignal.timeout(5_000) });
      if (response.ok) {
        const payload = feed === "forecast_3day" ? { text: await response.text() } : await response.json();
        return normalizeFeed(feed, payload);
      }
    } catch {
      // The snapshot below is the same fallback the data route uses.
    }
  }
  const filePath = path.join(process.cwd(), "data", "snapshots", `${feed}.json`);
  const text = await readFile(filePath, "utf8");
  return normalizeFeed(feed as FeedId, JSON.parse(text) as unknown);
}
