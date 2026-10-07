import * as THREE from "three";

import { classFromCode, EXPOSURE_COLORS } from "@/lib/engine/globe/exposure";
import { geodeticToScene, kmToScene } from "@/lib/engine/globe/frames";
import { GROUND_TRACK_SAMPLES, type StarmindSample } from "@/lib/engine/globe/trail";
import { circularPositionKm } from "@/lib/engine/orbit/eclipse";
import { raanAtUtc, type StarmindOrbit } from "@/lib/engine/orbit/j2";
import { RE_M } from "@/lib/engine/orbit/constants";

const RING_SEGMENTS = 256;
/** Lift of the ground track above the surface, km, so it draws over the zone overlays. */
const GROUND_TRACK_LIFT_KM = 12;

/** The orbit as a closed loop in the inertial frame. It precesses (J2, or with the Sun for SSO) as time moves. */
export function createOrbitRing(): THREE.LineLoop {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(RING_SEGMENTS * 3), 3));
  const material = new THREE.LineBasicMaterial({
    color: "#cfe6ff",
    transparent: true,
    opacity: 0.6,
    toneMapped: false,
  });
  const ring = new THREE.LineLoop(geometry, material);
  ring.name = "orbit-ring";
  return ring;
}

const ringPoint = new THREE.Vector3();

export function updateOrbitRing(ring: THREE.LineLoop, orbit: StarmindOrbit, utcMs: number): void {
  const positions = ring.geometry.getAttribute("position") as THREE.BufferAttribute;
  const raanDeg = raanAtUtc(orbit, utcMs);
  const radiusKm = RE_M / 1000 + orbit.altitudeKm;
  for (let index = 0; index < RING_SEGMENTS; index += 1) {
    const eci = circularPositionKm(radiusKm, orbit.inclinationDeg, raanDeg, (index * 360) / RING_SEGMENTS);
    kmToScene(eci, ringPoint);
    positions.setXYZ(index, ringPoint.x, ringPoint.y, ringPoint.z);
  }
  positions.needsUpdate = true;
  ring.geometry.computeBoundingSphere();
}

/** Earth-fixed ground track (add it to the rotating Earth group), colored by exposure, fading with age. */
export function createGroundTrack(): THREE.Line {
  const count = GROUND_TRACK_SAMPLES + 1;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  // Four components: three.js then blends per-vertex alpha.
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 4), 4));
  geometry.setDrawRange(0, 0);
  const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, toneMapped: false, depthWrite: false });
  const line = new THREE.Line(geometry, material);
  line.name = "ground-track";
  return line;
}

const trackPoint = new THREE.Vector3();
const swatch = new THREE.Color();

export function updateGroundTrack(line: THREE.Line, samples: StarmindSample[]): void {
  const positions = line.geometry.getAttribute("position") as THREE.BufferAttribute;
  const colors = line.geometry.getAttribute("color") as THREE.BufferAttribute;
  const count = Math.min(samples.length, positions.count);
  for (let index = 0; index < count; index += 1) {
    const sample = samples[index];
    geodeticToScene(sample.latDeg, sample.lonDeg, GROUND_TRACK_LIFT_KM, trackPoint);
    positions.setXYZ(index, trackPoint.x, trackPoint.y, trackPoint.z);
    swatch.set(EXPOSURE_COLORS[classFromCode(sample.code)]);
    const age = count > 1 ? index / (count - 1) : 1;
    colors.setXYZW(index, swatch.r, swatch.g, swatch.b, 0.08 + 0.92 * age * age);
  }
  positions.needsUpdate = true;
  colors.needsUpdate = true;
  line.geometry.setDrawRange(0, count);
  line.geometry.computeBoundingSphere();
}
