import * as Cesium from "cesium";
import type { GlobeTheme, ImageryMode } from "./types";

const STYLE_ID = "cesium-plugin-style";

export function ensurePluginStyle(): void {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .cesium-plugin-host,
    .cesium-plugin-host .cesium-viewer,
    .cesium-plugin-host .cesium-viewer-cesiumWidgetContainer,
    .cesium-plugin-host .cesium-widget,
    .cesium-plugin-host .cesium-widget canvas {
      width: 100%;
      height: 100%;
    }
    .cesium-plugin-host .cesium-viewer-toolbar,
    .cesium-plugin-host .cesium-viewer-animationContainer,
    .cesium-plugin-host .cesium-viewer-timelineContainer,
    .cesium-plugin-host .cesium-viewer-bottom,
    .cesium-plugin-host .cesium-viewer-fullscreenContainer {
      display: none;
    }
  `;
  document.head.appendChild(style);
}

export function createViewer(container: HTMLElement, theme: GlobeTheme): Cesium.Viewer {
  ensurePluginStyle();
  const credits = document.createElement("div");
  credits.hidden = true;
  container.appendChild(credits);
  const viewer = new Cesium.Viewer(container, {
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    baseLayer: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    vrButton: false,
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    creditContainer: credits,
    skyAtmosphere: new Cesium.SkyAtmosphere(),
  });
  viewer.scene.globe.enableLighting = true;
  viewer.scene.highDynamicRange = false;
  applyTheme(viewer, theme);
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(-40, -20, 22_000_000),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-90),
      roll: 0,
    },
  });
  return viewer;
}

export function applyTheme(viewer: Cesium.Viewer, theme: GlobeTheme): void {
  if (viewer.isDestroyed()) return;
  const background = Cesium.Color.fromCssColorString(theme.background);
  viewer.scene.backgroundColor = background;
  viewer.scene.globe.baseColor = background;
  const widget = viewer.canvas?.parentElement;
  if (widget) widget.style.background = theme.background;
}

export async function installImagery(
  viewer: Cesium.Viewer,
  ionToken?: string,
): Promise<ImageryMode> {
  if (ionToken) {
    Cesium.Ion.defaultAccessToken = ionToken;
    try {
      const provider = await Cesium.createWorldImageryAsync();
      if (!viewer.isDestroyed()) {
        viewer.imageryLayers.addImageryProvider(provider);
      }
      return "ion";
    } catch (error) {
      console.warn("Cesium ion imagery failed; using Natural Earth II", error);
    }
  }
  try {
    const provider = await Cesium.TileMapServiceImageryProvider.fromUrl(
      Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII"),
    );
    if (!viewer.isDestroyed()) {
      viewer.imageryLayers.addImageryProvider(provider);
    }
    return "natural-earth";
  } catch (error) {
    console.warn("Natural Earth II unavailable; showing a bare ellipsoid", error);
    return "ellipsoid";
  }
}
