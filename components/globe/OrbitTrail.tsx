"use client";

import { BufferGeometry, Float32BufferAttribute, Points, PointsMaterial } from "three";

import { exposureColorHex, hexToRgb } from "@/components/globe/palette";
import { TRAIL_SAMPLES, type TrailSample } from "@/lib/engine/propagate";
import { latLngAltToKm } from "@/lib/globe/spherical";

export function createOrbitTrail(): Points {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(TRAIL_SAMPLES * 3), 3));
  geometry.setAttribute("color", new Float32BufferAttribute(new Float32Array(TRAIL_SAMPLES * 3), 3));
  const material = new PointsMaterial({
    size: 4.5,
    vertexColors: true,
    sizeAttenuation: false,
    depthWrite: false,
  });
  return new Points(geometry, material);
}

export function writeOrbitTrail(points: Points, trail: TrailSample[]): void {
  const position = points.geometry.getAttribute("position");
  const color = points.geometry.getAttribute("color");
  const count = Math.min(trail.length, TRAIL_SAMPLES);
  for (let index = 0; index < count; index += 1) {
    const sample = trail[index];
    const [x, y, z] = latLngAltToKm(sample.latDeg, sample.lngDeg, sample.altKm);
    position.setXYZ(index, x, y, z);
    const [r, g, b] = hexToRgb(exposureColorHex(sample.exposure));
    color.setXYZ(index, r, g, b);
  }
  position.needsUpdate = true;
  color.needsUpdate = true;
}
