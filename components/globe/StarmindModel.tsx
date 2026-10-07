"use client";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { EARTH_RADIUS_KM } from "@/lib/engine/globe/frames";
import type { ShadowKind } from "@/lib/engine/orbit/eclipse";

/** Sourced (spacex.com Starmind sheet): wingspan, height, radiator area. The rest of the model is illustrative. */
export const WINGSPAN_M = 75;
export const HEIGHT_M = 30;
export const RADIATOR_M2 = 160;
export const MODEL_URL = "/models/starmind.glb";

/** Enlarged so the craft is visible on the whole globe (75 m becomes 375 km). A display choice. */
export const ENLARGED_SCALE = 5000;
export type CraftScale = "enlarged" | "true";

export function scaleLabel(scale: CraftScale): string {
  return scale === "true"
    ? `True scale, ${WINGSPAN_M} m wingspan. Illustrative geometry.`
    : `Spacecraft ×${ENLARGED_SCALE.toLocaleString("en-US")}. Illustrative geometry.`;
}

const METRE_IN_SCENE = 1 / (EARTH_RADIUS_KM * 1000);

export interface Craft {
  /** Rendered on its own after the world, so it can be lit and depth-tested separately. */
  scene: THREE.Scene;
  root: THREE.Group;
  /** Displayed wingspan in scene units, for the follow camera. */
  sizeScene: () => number;
  setScale: (scale: CraftScale) => void;
  /**
   * Place and orient the craft: nadir-pointing (+Y body up), +X along the velocity, wings (along ±Z, the orbit
   * normal axis) turned towards the Sun. Lighting follows the shadow state.
   */
  update: (position: THREE.Vector3, velocity: THREE.Vector3, sun: THREE.Vector3, shadow: ShadowKind) => void;
  dispose: () => void;
}

export function createCraft(): Craft {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.name = "starmind";
  scene.add(root);

  // No reflection map: pre-filtering one (PMREM) blocks the main thread for seconds on software WebGL. A hemisphere
  // light gives the same broad fill: Earth blue from below, black sky above. It is re-aimed at nadir every frame.
  const sunLight = new THREE.DirectionalLight("#fff6e8", 3);
  const earthshine = new THREE.DirectionalLight("#7fa6d9", 0.3);
  const sky = new THREE.HemisphereLight("#0b0f18", "#4d74a8", 0.6);
  scene.add(sunLight, earthshine, sky, new THREE.AmbientLight("#9fb4d0", 0.04));

  let factor = ENLARGED_SCALE;
  const pivots: THREE.Object3D[] = [];
  let model: THREE.Group | null = null;
  let disposed = false;
  new GLTFLoader().load(MODEL_URL, (gltf) => {
    if (disposed) {
      return;
    }
    model = gltf.scene;
    model.traverse((object) => {
      if (object.name.startsWith("WingPivot")) {
        pivots.push(object);
      }
    });
    root.add(model);
  });

  const basis = new THREE.Matrix4();
  const xAxis = new THREE.Vector3();
  const yAxis = new THREE.Vector3();
  const zAxis = new THREE.Vector3();
  const sunBody = new THREE.Vector3();
  const inverse = new THREE.Quaternion();

  return {
    scene,
    root,
    sizeScene: () => WINGSPAN_M * METRE_IN_SCENE * factor,
    setScale: (scale) => {
      factor = scale === "true" ? 1 : ENLARGED_SCALE;
    },
    update: (position, velocity, sun, shadow) => {
      root.position.copy(position);
      root.scale.setScalar(METRE_IN_SCENE * factor);
      // Right-handed body frame: +Y zenith, +X the velocity made perpendicular to it, +Z = X × Y (minus orbit normal).
      yAxis.copy(position).normalize();
      xAxis.copy(velocity).addScaledVector(yAxis, -velocity.dot(yAxis)).normalize();
      zAxis.crossVectors(xAxis, yAxis);
      basis.makeBasis(xAxis, yAxis, zAxis);
      root.quaternion.setFromRotationMatrix(basis);

      // Single-axis tracking: each wing turns about the orbit normal so its cells face the Sun's in-plane direction.
      inverse.copy(root.quaternion).invert();
      sunBody.copy(sun).applyQuaternion(inverse);
      const angle = Math.atan2(-sunBody.x, sunBody.y);
      for (const pivot of pivots) {
        pivot.rotation.z = angle;
      }

      const lit = shadow === "sun" ? 1 : shadow === "penumbra" ? 0.45 : 0;
      sunLight.position.copy(sun).multiplyScalar(10);
      sunLight.intensity = 3 * lit;
      // Earthshine comes up from below, strongest over the day side.
      earthshine.position.copy(yAxis).negate();
      earthshine.intensity = 0.05 + 0.45 * Math.max(0, yAxis.dot(sun));
      sky.position.copy(yAxis);
      sky.intensity = 0.15 + 0.75 * Math.max(0, yAxis.dot(sun));
    },
    dispose: () => {
      disposed = true;
      model?.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material as THREE.MeshStandardMaterial | undefined;
        if (material) {
          material.map?.dispose();
          material.dispose();
        }
      });
    },
  };
}
