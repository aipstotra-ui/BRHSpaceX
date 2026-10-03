import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type * as Cesium from "cesium";
import type { GlobeTheme, ImageryMode } from "./types";
import { applyTheme, createViewer, installImagery } from "./viewer";

export function useCesiumViewer(
  container: RefObject<HTMLDivElement | null>,
  options: {
    theme: GlobeTheme;
    ionToken?: string;
    onImagery?: (mode: ImageryMode) => void;
  },
): Cesium.Viewer | null {
  const [viewer, setViewer] = useState<Cesium.Viewer | null>(null);
  const { theme, ionToken, onImagery } = options;
  const themeRef = useRef(theme);
  const onImageryRef = useRef(onImagery);
  themeRef.current = theme;
  onImageryRef.current = onImagery;

  useEffect(() => {
    const host = container.current;
    if (!host) return undefined;
    let created: Cesium.Viewer;
    try {
      created = createViewer(host, themeRef.current);
    } catch (error) {
      console.error("Cesium viewer failed to start", error);
      return undefined;
    }
    let cancelled = false;
    installImagery(created, ionToken).then((mode) => {
      if (cancelled || created.isDestroyed()) return;
      applyTheme(created, themeRef.current);
      setViewer(created);
      onImageryRef.current?.(mode);
    });
    return () => {
      cancelled = true;
      setViewer(null);
      if (!created.isDestroyed()) created.destroy();
    };
  }, [container, ionToken]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    applyTheme(viewer, theme);
  }, [viewer, theme]);

  return viewer;
}
