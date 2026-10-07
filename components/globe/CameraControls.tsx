"use client";

import type { CraftScale } from "@/components/globe/StarmindModel";

export function CameraControls({
  follow,
  onFollow,
  scale,
  onScale,
  onZoom,
}: {
  follow: boolean;
  onFollow: (follow: boolean) => void;
  scale: CraftScale;
  onScale: (scale: CraftScale) => void;
  onZoom: (direction: 1 | -1) => void;
}) {
  return (
    <div className="globe-toolbar" role="group" aria-label="Camera">
      <button type="button" className="rok-btn rok-btn--sm button" onClick={() => onZoom(1)}>
        Zoom in
      </button>
      <button type="button" className="rok-btn rok-btn--sm button" onClick={() => onZoom(-1)}>
        Zoom out
      </button>
      <button type="button" className="rok-btn rok-btn--sm button" aria-pressed={follow} onClick={() => onFollow(!follow)}>
        Follow Starmind
      </button>
      <button
        type="button"
        className="rok-btn rok-btn--sm button"
        aria-pressed={scale === "true"}
        onClick={() => onScale(scale === "true" ? "enlarged" : "true")}
      >
        True scale
      </button>
      <p className="eyebrow rok-subtle">{follow ? "Follow mode" : "Free orbit"}</p>
    </div>
  );
}
