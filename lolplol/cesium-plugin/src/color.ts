import type { GlobeTheme } from "./types";

export function parseRgb(css: string): [number, number, number] {
  const text = css.trim();
  if (text.startsWith("#")) {
    const hex = text.slice(1);
    const full =
      hex.length === 3
        ? hex
            .split("")
            .map((channel) => channel + channel)
            .join("")
        : hex;
    return [
      Number.parseInt(full.slice(0, 2), 16),
      Number.parseInt(full.slice(2, 4), 16),
      Number.parseInt(full.slice(4, 6), 16),
    ];
  }
  const match = text.match(/rgba?\(([^)]+)\)/i);
  if (match) {
    const parts = match[1].split(",").map((part) => Number(part.trim()));
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  }
  return [255, 255, 255];
}

export function thermalRgb(
  theme: GlobeTheme,
  amount: number,
): [number, number, number] {
  const stops = theme.thermal.map(parseRgb);
  const clamped = Math.max(0, Math.min(1, amount));
  const scaled = clamped * (stops.length - 1);
  const index = Math.floor(scaled);
  const next = Math.min(stops.length - 1, index + 1);
  const mix = scaled - index;
  const start = stops[index] ?? stops[0];
  const end = stops[next] ?? start;
  return [
    start[0] + (end[0] - start[0]) * mix,
    start[1] + (end[1] - start[1]) * mix,
    start[2] + (end[2] - start[2]) * mix,
  ];
}

export function fluxAmount(flux: number | null, maxFlux: number): number {
  if (flux == null || !Number.isFinite(flux) || flux <= 0 || maxFlux <= 0) return 0;
  return Math.max(
    0,
    Math.min(1, Math.log10(1 + flux) / Math.log10(1 + maxFlux)),
  );
}
