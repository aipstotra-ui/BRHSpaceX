import snapshot from "@/data/snapshots/aurora.json";

/** OVATION value used as a ground-aurora proxy. The cutoff is an estimate, not a dose. */
export const AURORA_PROXY_MIN = 10;

export interface AuroraPoint {
  latDeg: number;
  lonDeg: number;
  aurora: number;
}

export const auroraObservationTime = snapshot["Observation Time"];
export const auroraForecastTime = snapshot["Forecast Time"];

/** Longitudes above 180° are converted to negative. Values below the proxy cutoff are dropped. */
export function auroraProxyPoints(minimum = AURORA_PROXY_MIN): AuroraPoint[] {
  const points: AuroraPoint[] = [];
  for (const triple of snapshot.coordinates) {
    const lon = triple[0];
    const lat = triple[1];
    const aurora = triple[2];
    if (aurora < minimum) {
      continue;
    }
    points.push({
      latDeg: lat,
      lonDeg: lon > 180 ? lon - 360 : lon,
      aurora,
    });
  }
  return points;
}
