"use client";

import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Matrix4, Object3D, PerspectiveCamera, Vector3 } from "three";

export function attachCameraControls(camera: PerspectiveCamera, element: HTMLElement): OrbitControls {
  const controls = new OrbitControls(camera, element);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 7500;
  controls.maxDistance = 40000;
  controls.zoomSpeed = 0.6;
  controls.rotateSpeed = 0.45;
  return controls;
}

const radial = new Vector3();
const desired = new Vector3();
const wing = new Vector3();
const nose = new Vector3();
const basis = new Matrix4();

/** Ease the camera onto the radial outside the vehicle. The 0.85 s time constant is an estimate. */
export function followStarmind(camera: PerspectiveCamera, target: Vector3, gapKm: number, dtSeconds: number): void {
  radial.copy(target).normalize();
  desired.copy(radial).multiplyScalar(target.length() + gapKm);
  const alpha = 1 - Math.exp(-dtSeconds / 0.85);
  camera.position.lerp(desired, alpha);
  camera.lookAt(target);
}

export function aimVehicle(mesh: Object3D, target: Vector3, previous: Vector3): void {
  radial.copy(target).normalize();
  nose.copy(target).sub(previous);
  if (nose.lengthSq() < 1) {
    mesh.position.copy(target);
    previous.copy(target);
    return;
  }
  nose.normalize();
  wing.crossVectors(radial, nose).normalize();
  nose.crossVectors(wing, radial).normalize();
  basis.makeBasis(wing, radial, nose);
  mesh.quaternion.setFromRotationMatrix(basis);
  mesh.position.copy(target);
  previous.copy(target);
}

export function placeCamera(camera: PerspectiveCamera, distanceKm: number): void {
  if (camera.position.lengthSq() < 1) {
    camera.position.set(0.6, 0.45, 1);
  }
  camera.position.setLength(distanceKm);
}
