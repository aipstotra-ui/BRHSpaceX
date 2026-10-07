"use client";

import { useEffect, useState, type RefObject } from "react";

import { StatusBadge, type Status } from "@/components/ui/StatusBadge";
import type { ExposureClass } from "@/lib/engine/globe/exposure";
import type { ShadowKind } from "@/lib/engine/orbit/eclipse";

/** What the render loop knows each frame. The HUD copies it at HUD_HZ so React does not re-render every frame. */
export interface HudState {
  utcMs: number;
  latDeg: number;
  lonDeg: number;
  altKm: number;
  exposure: ExposureClass;
  shadow: ShadowKind;
  kp: number | null;
  protonPfu: number | null;
}

const HUD_HZ = 10;

const EXPOSURE_STATUS: Record<ExposureClass, Status> = {
  SAA: "critical",
  SEP: "critical",
  auroral: "caution",
  "outer belt": "caution",
  nominal: "nominal",
};

const EXPOSURE_TEXT: Record<ExposureClass, string> = {
  SAA: "In SAA",
  SEP: "In proton cap",
  auroral: "In auroral zone",
  "outer belt": "In outer belt",
  nominal: "No hazard zone",
};

function formatUtc(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 19).replace("T", " ") + " UTC";
}

function latLon(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(1)}°${value >= 0 ? positive : negative}`;
}

export function GlobeHud({
  stateRef,
  playing,
  speedLabel,
}: {
  stateRef: RefObject<HudState | null>;
  playing: boolean;
  speedLabel: string;
}) {
  const [hud, setHud] = useState<HudState | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = stateRef.current;
      setHud(next ? { ...next } : null);
    }, 1000 / HUD_HZ);
    return () => window.clearInterval(timer);
  }, [stateRef]);

  if (!hud) {
    return null;
  }
  const inShadow = hud.shadow !== "sun";
  return (
    <div className="globe-hud" data-testid="globe-hud">
      <div className="globe-hud__top">
        <p className="data-sm globe-hud__time" data-testid="hud-time">
          {formatUtc(hud.utcMs)}
        </p>
        <p className="eyebrow rok-subtle">{playing ? `Playing ${speedLabel}` : "Paused"}</p>
      </div>
      <div className="globe-hud__badges" aria-label="Starmind right now">
        <StatusBadge status={EXPOSURE_STATUS[hud.exposure]}>
          {EXPOSURE_TEXT[hud.exposure]}
        </StatusBadge>
        <StatusBadge status={inShadow ? "caution" : "nominal"}>
          {hud.shadow === "umbra" ? "Eclipse" : hud.shadow === "penumbra" ? "Penumbra" : "Sunlit"}
        </StatusBadge>
      </div>
      <dl className="globe-hud__readout data-sm">
        <div>
          <dt className="rok-subtle">Sub-point</dt>
          <dd>
            {latLon(hud.latDeg, "N", "S")} {latLon(hud.lonDeg, "E", "W")}
          </dd>
        </div>
        <div>
          <dt className="rok-subtle">Alt</dt>
          <dd>{hud.altKm.toFixed(0)} km</dd>
        </div>
        <div>
          <dt className="rok-subtle">Kp</dt>
          <dd>{hud.kp === null ? "n/a" : hud.kp.toFixed(1)}</dd>
        </div>
        <div>
          <dt className="rok-subtle">&gt;10 MeV</dt>
          <dd>{hud.protonPfu === null ? "n/a" : `${hud.protonPfu < 10 ? hud.protonPfu.toFixed(1) : hud.protonPfu.toFixed(0)} pfu`}</dd>
        </div>
      </dl>
    </div>
  );
}
