"use client";

import { classFromCode, EXPOSURE_COLORS } from "@/lib/engine/globe/exposure";
import { GBM_SAA_LAT, GBM_SAA_LON } from "@/lib/engine/radiation";

export interface TrackPoint {
  latDeg: number;
  lonDeg: number;
  code?: number;
}

function project(latDeg: number, lonDeg: number): { x: number; y: number } {
  return { x: lonDeg + 180, y: 90 - latDeg };
}

export function GroundTrack2D({
  starlink,
  trail,
  starmind,
  aurora,
}: {
  starlink: TrackPoint[];
  trail: TrackPoint[];
  starmind: TrackPoint | null;
  aurora: TrackPoint[];
}) {
  const saa = GBM_SAA_LAT.map((lat, index) => {
    const point = project(lat, GBM_SAA_LON[index]);
    return `${point.x},${point.y}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 360 180" role="img" aria-label="Ground track" style={{ width: "100%", background: "#0e1a27" }}>
      <rect width="360" height="180" fill="#0e1a27" />
      <polygon points={saa} fill="none" stroke="#e23b3b" strokeWidth="0.6" />
      {aurora.map((point, index) => {
        const at = project(point.latDeg, point.lonDeg);
        return <circle key={`a${index}`} cx={at.x} cy={at.y} r="0.35" fill="#7d5cff" opacity="0.7" />;
      })}
      {starlink.map((point, index) => {
        const at = project(point.latDeg, point.lonDeg);
        return <circle key={`s${index}`} cx={at.x} cy={at.y} r="0.45" fill="#9ad" />;
      })}
      {trail.map((point, index) => {
        const at = project(point.latDeg, point.lonDeg);
        const kind = classFromCode(point.code ?? 0);
        return <circle key={`t${index}`} cx={at.x} cy={at.y} r="0.7" fill={EXPOSURE_COLORS[kind]} />;
      })}
      {starmind ? (
        <circle
          cx={project(starmind.latDeg, starmind.lonDeg).x}
          cy={project(starmind.latDeg, starmind.lonDeg).y}
          r="2.2"
          fill="#f4f1ea"
        />
      ) : null}
    </svg>
  );
}
