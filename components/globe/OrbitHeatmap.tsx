"use client";

import type { OrbitCandidate } from "@/lib/engine/orbit/optimizer";

export function OrbitHeatmap({ rows }: { rows: OrbitCandidate[] }) {
  if (rows.length === 0) {
    return <p className="rok-muted">Empty</p>;
  }
  const best = rows[0];
  const maxScore = Math.max(...rows.map((row) => row.score));
  const minScore = Math.min(...rows.map((row) => row.score));
  return (
    <svg viewBox="0 0 320 180" role="img" aria-label="Orbit score rings" className="orbit-heatmap">
      <rect width="320" height="180" fill="#000" />
      <circle cx="160" cy="90" r="28" fill="#1d4e89" />
      {rows.map((row) => {
        const span = maxScore - minScore || 1;
        const shade = Math.round(255 - ((row.score - minScore) / span) * 180);
        const radius = 36 + (row.altitudeKm - 500) / 40;
        const bestRow = row.altitudeKm === best?.altitudeKm && row.ltanHours === best?.ltanHours;
        return (
          <ellipse
            key={`${row.altitudeKm}-${row.ltanHours}`}
            cx="160"
            cy="90"
            rx={radius}
            ry={radius * 0.42}
            fill="none"
            stroke={bestRow ? "#f4f7fb" : `rgb(${shade},${shade},${shade})`}
            strokeWidth={bestRow ? 2.4 : 1}
          />
        );
      })}
      {best ? (
        <text x="16" y="20" fill="#f4f7fb" fontSize="11">
          Best {best.altitudeKm} km LTAN {best.ltanHours}
        </text>
      ) : null}
    </svg>
  );
}
