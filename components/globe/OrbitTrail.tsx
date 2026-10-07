"use client";

import * as THREE from "three";

import { classFromCode, EXPOSURE_COLORS, EXPOSURE_LABELS, type ExposureClass } from "@/lib/engine/globe/exposure";
import { geodeticToScene } from "@/lib/engine/globe/frames";
import { TRAIL_SAMPLES, type StarmindSample } from "@/lib/engine/globe/trail";

/** Scene position of a geodetic point, using the one frame convention in lib/engine/globe/frames.ts. */
export function surfaceVector(latDeg: number, lonDeg: number, altKm: number, out = new THREE.Vector3()): THREE.Vector3 {
  geodeticToScene(latDeg, lonDeg, altKm, out);
  return out;
}

/** A line with room for one trail; updateTrailLine fills it in place every frame. */
export function createTrailLine(): THREE.Line {
  const count = TRAIL_SAMPLES + 1;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setDrawRange(0, 0);
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({ vertexColors: true }));
}

const scratch = new THREE.Vector3();
const swatch = new THREE.Color();

export function updateTrailLine(line: THREE.Line, samples: StarmindSample[]): void {
  const positions = line.geometry.getAttribute("position") as THREE.BufferAttribute;
  const colors = line.geometry.getAttribute("color") as THREE.BufferAttribute;
  const count = Math.min(samples.length, positions.count);
  for (let index = 0; index < count; index += 1) {
    const sample = samples[index];
    // 30 km above the orbit so the line is not hidden by the craft.
    geodeticToScene(sample.latDeg, sample.lonDeg, sample.altKm + 30, scratch);
    positions.setXYZ(index, scratch.x, scratch.y, scratch.z);
    swatch.set(EXPOSURE_COLORS[classFromCode(sample.code)]);
    colors.setXYZ(index, swatch.r, swatch.g, swatch.b);
  }
  positions.needsUpdate = true;
  colors.needsUpdate = true;
  line.geometry.setDrawRange(0, count);
  line.geometry.computeBoundingSphere();
}

export function OrbitTrail() {
  return (
    <div className="legend">
      <ul className="legend__items" aria-label="Trail colors">
        {(Object.keys(EXPOSURE_COLORS) as ExposureClass[]).map((kind) => (
          <li key={kind} className="eyebrow">
            <span className="swatch" style={{ background: EXPOSURE_COLORS[kind] }} aria-hidden="true" />
            {EXPOSURE_LABELS[kind]}
          </li>
        ))}
      </ul>
      <p className="note">Trail: the last orbit of ground track, {TRAIL_SAMPLES + 1} samples, ending at the craft. Shaded bands: SAA, auroral oval for the timeline Kp, and the solar-proton cap during S1+ events.</p>
    </div>
  );
}
