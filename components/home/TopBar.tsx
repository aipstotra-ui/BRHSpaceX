"use client";

import { AppNav } from "@/components/ui/AppNav";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { FeedPhase } from "@/components/ui/SnapshotBanner";
import { getPreset } from "@/lib/presets";
import { useShellStore } from "@/lib/store";
import { useOrbitStore } from "@/lib/store/orbit";

function FeedPill({ phase }: { phase: FeedPhase }) {
  if (phase === "live") {
    return <StatusBadge status="nominal">Live NOAA data</StatusBadge>;
  }
  if (phase === "snapshot") {
    return <StatusBadge status="caution">Snapshot data</StatusBadge>;
  }
  if (phase === "error") {
    return <StatusBadge status="critical">Feed error</StatusBadge>;
  }
  if (phase === "empty") {
    return <StatusBadge status="caution">Feed empty</StatusBadge>;
  }
  return <span className="eyebrow rok-subtle">Checking feed</span>;
}

export function TopBar({
  feed,
  copilotOpen,
  onCopilot,
  onChangeChip,
}: {
  feed: FeedPhase;
  copilotOpen: boolean;
  onCopilot: () => void;
  onChangeChip: () => void;
}) {
  const presetId = useShellStore((state) => state.presetId);
  const altitudeKm = useOrbitStore((state) => state.altitudeKm);
  const inclinationDeg = useOrbitStore((state) => state.inclinationDeg);
  const sunSynchronous = useOrbitStore((state) => state.sunSynchronous);
  const ltanHours = useOrbitStore((state) => state.ltanHours);
  const chip = getPreset(presetId);
  const orbitKind = sunSynchronous
    ? `SSO ${String(ltanHours ?? 0).padStart(2, "0")}:00 LTAN`
    : "Inclined orbit";

  return (
    <AppNav className="topbar">
      <dl className="topbar__context">
        <div>
          <dt className="eyebrow rok-subtle">Chip</dt>
          <dd className="body-sm">
            <button type="button" className="rok-btn rok-btn--quiet topbar__link" onClick={onChangeChip}>
              {chip.title}
            </button>
          </dd>
        </div>
        <div>
          <dt className="eyebrow rok-subtle">Orbit</dt>
          <dd className="data-sm">
            {orbitKind} · {altitudeKm.toFixed(0)} KM · {inclinationDeg.toFixed(1)}°
          </dd>
        </div>
      </dl>
      <div className="topbar__actions">
        <FeedPill phase={feed} />
        <button
          type="button"
          className="rok-btn rok-btn--sm button"
          aria-expanded={copilotOpen}
          aria-controls="copilot-drawer"
          onClick={onCopilot}
        >
          <svg viewBox="0 0 14 14" aria-hidden="true">
            <rect x="4.5" y="1" width="5" height="8" rx="2.5" fill="none" stroke="currentColor" />
            <path d="M2.5 6.5a4.5 4.5 0 0 0 9 0M7 11v2" fill="none" stroke="currentColor" />
          </svg>
          {copilotOpen ? "Close copilot" : "Ask copilot"}
        </button>
      </div>
    </AppNav>
  );
}
