import * as Cesium from "cesium";
import { fluxAmount, thermalRgb } from "./color";
import { altitudeAt } from "./orbit";
import type { FluxGrid, GlobeTheme, Track } from "./types";

const TRACK_PREFIX = "cp-orbit-";
const SATELLITE_ID = "cp-sat";
const overlayLayer = new WeakMap<Cesium.Viewer, Cesium.ImageryLayer>();
const overlayUrl = new WeakMap<Cesium.Viewer, string>();

function gridMax(grid: FluxGrid): number {
  if (grid.flux_cm2_s_max != null && Number.isFinite(grid.flux_cm2_s_max)) {
    return grid.flux_cm2_s_max;
  }
  let max = 0;
  for (const row of grid.flux_cm2_s) {
    for (const value of row) {
      if (value != null && value > max) max = value;
    }
  }
  return max;
}

function sampleFlux(grid: FluxGrid, lat: number, lon: number): number | null {
  let row = 0;
  let col = 0;
  let bestLat = Number.POSITIVE_INFINITY;
  let bestLon = Number.POSITIVE_INFINITY;
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
  for (let index = 0; index < grid.lat_deg.length; index += 1) {
    const delta = Math.abs(grid.lat_deg[index] - lat);
    if (delta < bestLat) {
      bestLat = delta;
      row = index;
    }
  }
  for (let index = 0; index < grid.lon_deg.length; index += 1) {
    const delta = Math.abs(grid.lon_deg[index] - wrapped);
    if (delta < bestLon) {
      bestLon = delta;
      col = index;
    }
  }
  const value = grid.flux_cm2_s[row]?.[col];
  return value == null ? null : Number(value);
}

function gridImage(grid: FluxGrid, theme: GlobeTheme): string {
  const height = grid.lat_deg.length;
  const width = grid.lon_deg.length;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const context = canvas.getContext("2d");
  if (!context) return "";
  const image = context.createImageData(canvas.width, canvas.height);
  const maxFlux = gridMax(grid);
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const value = grid.flux_cm2_s[row]?.[col] ?? null;
      const y = height - 1 - row;
      const offset = (y * canvas.width + col) * 4;
      if (value == null || !Number.isFinite(value)) {
        image.data[offset + 3] = 0;
        continue;
      }
      const [red, green, blue] = thermalRgb(theme, fluxAmount(value, maxFlux));
      image.data[offset] = red;
      image.data[offset + 1] = green;
      image.data[offset + 2] = blue;
      image.data[offset + 3] = value <= 0 ? 0 : 150;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

export async function syncFluxOverlay(
  viewer: Cesium.Viewer,
  grid: FluxGrid | null,
  theme: GlobeTheme,
): Promise<void> {
  const previous = overlayLayer.get(viewer);
  if (previous) {
    viewer.imageryLayers.remove(previous, true);
    overlayLayer.delete(viewer);
  }
  const previousUrl = overlayUrl.get(viewer);
  if (previousUrl) {
    URL.revokeObjectURL(previousUrl);
    overlayUrl.delete(viewer);
  }
  if (!grid || grid.lat_deg.length < 2 || grid.lon_deg.length < 2) return;
  const dataUrl = gridImage(grid, theme);
  if (!dataUrl) return;
  const blob = await (await fetch(dataUrl)).blob();
  if (viewer.isDestroyed()) return;
  const url = URL.createObjectURL(blob);
  overlayUrl.set(viewer, url);
  const provider = await Cesium.SingleTileImageryProvider.fromUrl(url, {
    rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90),
  });
  if (viewer.isDestroyed()) {
    URL.revokeObjectURL(url);
    return;
  }
  const layer = viewer.imageryLayers.addImageryProvider(provider);
  layer.alpha = 0.72;
  overlayLayer.set(viewer, layer);
}

export function clearFluxOverlay(viewer: Cesium.Viewer): void {
  const layer = overlayLayer.get(viewer);
  if (layer && !viewer.isDestroyed()) viewer.imageryLayers.remove(layer, true);
  overlayLayer.delete(viewer);
  const url = overlayUrl.get(viewer);
  if (url) URL.revokeObjectURL(url);
  overlayUrl.delete(viewer);
}

function clearTrack(viewer: Cesium.Viewer): void {
  const ids: string[] = [];
  for (const entity of viewer.entities.values) {
    const id = String(entity.id);
    if (id.startsWith(TRACK_PREFIX) || id === SATELLITE_ID) ids.push(id);
  }
  for (const id of ids) viewer.entities.removeById(id);
}

function epochOf(track: Track): Cesium.JulianDate {
  const raw = track.epoch_utc;
  if (raw) {
    const iso = raw.endsWith("Z") ? raw : `${raw}Z`;
    try {
      return Cesium.JulianDate.fromIso8601(iso);
    } catch {
      /* fall through */
    }
  }
  return Cesium.JulianDate.now();
}

export function syncTrack(
  viewer: Cesium.Viewer,
  track: Track | null,
  grid: FluxGrid | null,
  theme: GlobeTheme,
  playing: boolean,
): void {
  clearTrack(viewer);
  if (!track || track.lat_deg.length < 2) {
    viewer.clock.shouldAnimate = false;
    return;
  }
  const maxFlux = grid ? gridMax(grid) : 1;
  const step = track.lat_deg.length > 500 ? 2 : 1;
  let segment = 0;
  for (let start = 0; start < track.lat_deg.length - step; start += step) {
    const end = Math.min(track.lat_deg.length - 1, start + step);
    const lonDelta = Math.abs(track.lon_deg[end] - track.lon_deg[start]);
    if (lonDelta > 180) continue;
    const midLat = 0.5 * (track.lat_deg[start] + track.lat_deg[end]);
    const midLon = 0.5 * (track.lon_deg[start] + track.lon_deg[end]);
    const flux = grid ? sampleFlux(grid, midLat, midLon) : null;
    const [red, green, blue] = thermalRgb(theme, fluxAmount(flux, maxFlux));
    viewer.entities.add({
      id: `${TRACK_PREFIX}${segment}`,
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          track.lon_deg[start],
          track.lat_deg[start],
          altitudeAt(track, start) * 1000,
          track.lon_deg[end],
          track.lat_deg[end],
          altitudeAt(track, end) * 1000,
        ]),
        width: 3,
        arcType: Cesium.ArcType.NONE,
        material: new Cesium.Color(red / 255, green / 255, blue / 255, 0.95),
      },
    });
    segment += 1;
  }

  const start = epochOf(track);
  const position = new Cesium.SampledPositionProperty();
  const last = track.times_s.length - 1;
  for (let index = 0; index < track.lat_deg.length; index += 1) {
    const time = Cesium.JulianDate.addSeconds(
      start,
      track.times_s[index] ?? 0,
      new Cesium.JulianDate(),
    );
    position.addSample(
      time,
      Cesium.Cartesian3.fromDegrees(
        track.lon_deg[index],
        track.lat_deg[index],
        altitudeAt(track, index) * 1000,
      ),
    );
  }
  const ink = Cesium.Color.fromCssColorString(theme.ink);
  const ground = Cesium.Color.fromCssColorString(theme.background);
  viewer.entities.add({
    id: SATELLITE_ID,
    position,
    point: {
      pixelSize: 11,
      color: ink,
      outlineColor: ground,
      outlineWidth: 2,
    },
  });
  const stop = Cesium.JulianDate.addSeconds(
    start,
    track.times_s[last] ?? 0,
    new Cesium.JulianDate(),
  );
  viewer.clock.startTime = start.clone();
  viewer.clock.stopTime = stop.clone();
  viewer.clock.currentTime = start.clone();
  viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
  const span = Math.max(1, (track.times_s[last] ?? 1) - (track.times_s[0] ?? 0));
  viewer.clock.multiplier = span / 40;
  viewer.clock.shouldAnimate = playing;
}
