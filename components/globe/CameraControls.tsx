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
      <p className="eyebrow rok-subtle">{follow ? "Follow mode" : "Free orbit"}</p>
    </div>
  );
}
