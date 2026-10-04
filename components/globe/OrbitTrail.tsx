"use client";

import * as THREE from "three";

import { classFromCode, EXPOSURE_COLORS } from "@/lib/engine/globe/exposure";
import type { StarmindSample } from "@/lib/engine/globe/trail";

export function surfaceVector(latDeg: number, lonDeg: number, altKm: number, earthKm = 6378.137): THREE.Vector3 {
  const radius = (earthKm + altKm) / earthKm;
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.sin(lon),
  );
}

export function createTrailLine(samples: StarmindSample[]): THREE.LineSegments {
  const positions: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();
  for (let index = 1; index < samples.length; index += 1) {
    const previous = surfaceVector(samples[index - 1].latDeg, samples[index - 1].lonDeg, samples[index - 1].altKm + 30);
    const current = surfaceVector(samples[index].latDeg, samples[index].lonDeg, samples[index].altKm + 30);
    positions.push(previous.x, previous.y, previous.z, current.x, current.y, current.z);
    const kind = classFromCode(samples[index].code);
    color.set(EXPOSURE_COLORS[kind]);
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ vertexColors: true }),
  );
}

export function OrbitTrail(_props: { samples: StarmindSample[] }) {
  return null;
}
