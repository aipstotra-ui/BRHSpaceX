"use client";

import * as THREE from "three";

/** Sourced wingspan and height. Bus and chord sizes below are illustrative estimates. */
export const WINGSPAN_M = 75;
export const HEIGHT_M = 30;
export const RADIATOR_M2 = 160;
export const DISPLAY_SCALE = 4000;
export const ILLUSTRATIVE_LABEL = "illustrative geometry, not to scale.";

const BUS_M = 8;
const WING_CHORD_M = 12;

export function createStarmindGroup(): THREE.Group {
  const group = new THREE.Group();
  const toKm = DISPLAY_SCALE / 1000;
  const bus = new THREE.Mesh(
    new THREE.BoxGeometry(BUS_M * toKm, HEIGHT_M * toKm, BUS_M * toKm),
    new THREE.MeshStandardMaterial({ color: "#d9dde2" }),
  );
  group.add(bus);
  const wingLength = ((WINGSPAN_M - BUS_M) / 2) * toKm;
  const wing = new THREE.BoxGeometry(wingLength, 0.4 * toKm, WING_CHORD_M * toKm);
  const wingMaterial = new THREE.MeshStandardMaterial({ color: "#1d3557" });
  for (const sign of [-1, 1]) {
    const panel = new THREE.Mesh(wing, wingMaterial);
    panel.position.x = sign * ((BUS_M * toKm) / 2 + wingLength / 2);
    group.add(panel);
  }
  const radiator = new THREE.BoxGeometry(0.3 * toKm, 8 * toKm, 10 * toKm);
  const radiatorMaterial = new THREE.MeshStandardMaterial({ color: "#f7f4ee" });
  for (const sign of [-1, 1]) {
    const panel = new THREE.Mesh(radiator, radiatorMaterial);
    panel.position.z = sign * ((BUS_M * toKm) / 2 + 0.3 * toKm);
    group.add(panel);
  }
  group.userData.wingspanM = WINGSPAN_M;
  group.userData.heightM = HEIGHT_M;
  group.userData.radiatorM2 = RADIATOR_M2;
  group.userData.label = ILLUSTRATIVE_LABEL;
  return group;
}

export function StarmindModel() {
  return <p className="rok-muted">{ILLUSTRATIVE_LABEL}</p>;
}
