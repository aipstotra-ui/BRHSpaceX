"use client";

export function CameraControls({
  follow,
  onFollow,
  onZoom,
}: {
  follow: boolean;
  onFollow: (follow: boolean) => void;
  onZoom: (direction: 1 | -1) => void;
}) {
  return (
    <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", margin: "var(--space-3) 0" }}>
      <button type="button" className="rok-btn" onClick={() => onZoom(1)}>
        Zoom in
      </button>
      <button type="button" className="rok-btn" onClick={() => onZoom(-1)}>
        Zoom out
      </button>
      <button type="button" className="rok-btn" aria-pressed={follow} onClick={() => onFollow(!follow)}>
        Follow Starmind
      </button>
      <p className="rok-muted">{follow ? "Follow mode" : "Free orbit"}</p>
    </div>
  );
}
