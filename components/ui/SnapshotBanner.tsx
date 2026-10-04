"use client";

import { useEffect, useState } from "react";

export type FeedPhase = "loading" | "error" | "empty" | "live" | "snapshot";
type Phase = FeedPhase;

export function SnapshotBanner({ phase }: { phase: Phase }) {
  if (phase === "loading") {
    return <p className="body rok-muted">Loading</p>;
  }
  if (phase === "error") {
    return (
      <p className="body" style={{ color: "var(--status-critical)" }}>
        Error
      </p>
    );
  }
  if (phase === "empty") {
    return <p className="body rok-muted">Empty</p>;
  }
  if (phase !== "snapshot") {
    return null;
  }
  return (
    <p className="body" role="status" data-testid="snapshot-banner">
      Showing a snapshot. Live feed is unavailable.
    </p>
  );
}

/** Where the Kp feed came from: the live NOAA feed or the stored snapshot. */
export function useFeedPhase(): FeedPhase {
  const [phase, setPhase] = useState<Phase>("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/data/kp", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("status");
        }
        return (await response.json()) as { source?: string; data?: unknown };
      })
      .then((body) => {
        if (cancelled) {
          return;
        }
        if (body.source === "snapshot") {
          setPhase("snapshot");
        } else if (body.source === "live" && body.data != null) {
          setPhase("live");
        } else {
          setPhase("empty");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPhase("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return phase;
}

/** Full-width banner, shown only when a feed falls back to stored data. */
export function SnapshotFeedStatus({ phase }: { phase: FeedPhase }) {
  if (phase !== "snapshot") {
    return null;
  }
  return (
    <section className="rok-panel snapshot-strip" aria-label="Space weather feed">
      <SnapshotBanner phase={phase} />
    </section>
  );
}
