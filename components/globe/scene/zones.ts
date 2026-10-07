import * as THREE from "three";

import { surfaceVector } from "@/components/globe/OrbitTrail";
import { GBM_SAA_LAT, GBM_SAA_LON, inSaa } from "@/lib/engine/radiation";

// Zone overlays drawn on the rotating Earth. Equirectangular canvas textures on slightly larger spheres.
// Step 5 of the globe plan replaces these with smooth, physics-based layers.

export type TrackPoint = { latDeg: number; lonDeg: number };

type Rgba = [number, number, number, number];

/** Equirectangular overlay: each pixel takes the color the test returns, or stays clear. */
export function zoneTexture(test: (latDeg: number, lonDeg: number) => Rgba | null): THREE.CanvasTexture {
  const width = 512;
  const height = 256;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }
  const image = context.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    const lat = 90 - (y / (height - 1)) * 180;
    for (let x = 0; x < width; x += 1) {
      const lon = (x / (width - 1)) * 360 - 180;
      const color = test(lat, lon);
      if (!color) {
        continue;
      }
      const offset = (y * width + x) * 4;
      image.data.set(color, offset);
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export const AURORAL_RGBA: Rgba = [61, 220, 151, 90];
export const SEP_RGBA: Rgba = [255, 95, 210, 110];

export function saaOverlayTexture(): THREE.CanvasTexture {
  const width = 512;
  const height = 256;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }
  const image = context.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    const lat = 90 - (y / (height - 1)) * 180;
    for (let x = 0; x < width; x += 1) {
      const lon = (x / (width - 1)) * 360 - 180;
      if (!inSaa(lat, lon)) {
        continue;
      }
      const offset = (y * width + x) * 4;
      image.data[offset] = 214;
      image.data[offset + 1] = 48;
      image.data[offset + 2] = 112;
      image.data[offset + 3] = 120;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function auroraPoints(points: TrackPoint[]): THREE.Points {
  const positions = new Float32Array(points.length * 3);
  points.forEach((point, index) => {
    const at = surfaceVector(point.latDeg, point.lonDeg, 80);
    positions[index * 3] = at.x;
    positions[index * 3 + 1] = at.y;
    positions[index * 3 + 2] = at.z;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color: "#7d5cff", size: 0.012 }));
}

export function ovationLookup(points: TrackPoint[]): (latDeg: number, lonDeg: number) => boolean {
  const cells = new Set(points.map((point) => `${Math.round(point.latDeg)}|${(Math.round(point.lonDeg) + 360) % 360}`));
  return (latDeg, lonDeg) => cells.has(`${Math.round(latDeg)}|${(Math.round(lonDeg) + 360) % 360}`);
}

/** The Fermi GBM SAA ring as a line 40 km up. */
export function saaOutline(): THREE.Line {
  const points: number[] = [];
  const at = new THREE.Vector3();
  for (let index = 0; index < GBM_SAA_LAT.length; index += 1) {
    surfaceVector(GBM_SAA_LAT[index], GBM_SAA_LON[index], 40, at);
    points.push(at.x, at.y, at.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: "#e23b3b", toneMapped: false }));
}

/** Translucent overlay sphere for a zone texture, a little above the surface. */
export function overlaySphere(texture: THREE.Texture, radius: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 96, 64),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }),
  );
}
