import { useEffect, useRef } from "react";
import type { FluxGrid, GlobeTheme, ImageryMode, Track } from "./types";
import { clearFluxOverlay, syncFluxOverlay, syncTrack } from "./overlay";
import { useCesiumViewer } from "./useCesiumViewer";

export interface GlobeProps {
  /** Geodetic samples. Pass null for an empty globe. */
  track: Track | null;
  /** Trapped-flux grid drawn over the Earth and used to color the track. */
  fluxGrid: FluxGrid | null;
  playing: boolean;
  /** Host design tokens, already resolved to color strings. */
  theme: GlobeTheme;
  /**
   * Optional Cesium ion token. When omitted, the globe uses Cesium's
   * bundled Natural Earth II tiles, then a bare ellipsoid if those fail.
   * The host must still expose Cesium's static Workers/Assets
   * (`CESIUM_BASE_URL`), for example with vite-plugin-cesium.
   */
  ionToken?: string;
  className?: string;
  onImagery?: (mode: ImageryMode) => void;
}

/**
 * Cesium viewer that fills its parent. The parent needs a height and
 * `position: relative`. The viewer is destroyed on unmount.
 */
export function Globe({
  track,
  fluxGrid,
  playing,
  theme,
  ionToken,
  className,
  onImagery,
}: GlobeProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewer = useCesiumViewer(hostRef, { theme, ionToken, onImagery });
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return undefined;
    let cancelled = false;
    syncFluxOverlay(viewer, fluxGrid, theme).catch((error) => {
      if (!cancelled) console.warn("Flux overlay failed", error);
    });
    return () => {
      cancelled = true;
    };
  }, [viewer, fluxGrid, theme]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    syncTrack(viewer, track, fluxGrid, theme, playingRef.current);
  }, [viewer, track, fluxGrid, theme]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    viewer.clock.shouldAnimate = playing;
  }, [viewer, playing]);

  useEffect(() => {
    return () => {
      if (viewer && !viewer.isDestroyed()) clearFluxOverlay(viewer);
    };
  }, [viewer]);

  return (
    <div
      ref={hostRef}
      className={["cesium-plugin-host", className].filter(Boolean).join(" ")}
      style={{ position: "absolute", inset: 0 }}
    />
  );
}
