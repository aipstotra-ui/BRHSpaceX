"use client";

import { BoxGeometry, CanvasTexture, Group, Mesh, MeshStandardMaterial, SRGBColorSpace } from "three";

import {
  BUS_DEPTH_M,
  BUS_WIDTH_M,
  ILLUSTRATIVE_WINGSPAN_KM,
  RADIATOR_PANEL_M,
  STARMIND_HEIGHT_M,
  STARMIND_WINGSPAN_M,
  WING_CHORD_M,
} from "@/lib/globe/vehicle";

function solarTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#0c1c33";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const cellW = 14;
    const cellH = 18;
    for (let y = 2; y < canvas.height - 2; y += cellH + 2) {
      for (let x = 2; x < canvas.width - 2; x += cellW + 2) {
        context.fillStyle = (x + y) % ((cellW + 2) * 2) === 2 ? "#16365f" : "#1d4e86";
        context.fillRect(x, y, cellW, cellH);
      }
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Procedural bus, two solar wings, and two radiator panels. No external mesh. */
export function createStarmindModel(): Group {
  const group = new Group();
  group.name = "starmind";
  const texture = solarTexture();
  const bus = new Mesh(
    new BoxGeometry(BUS_WIDTH_M, STARMIND_HEIGHT_M, BUS_DEPTH_M),
    new MeshStandardMaterial({ color: 0x1c1f22, metalness: 0.55, roughness: 0.38 }),
  );
  const wingSpan = (STARMIND_WINGSPAN_M - BUS_WIDTH_M) / 2;
  const wingMaterial = new MeshStandardMaterial({
    map: texture,
    metalness: 0.25,
    roughness: 0.42,
    color: 0x9ec9ef,
  });
  const wingGeometry = new BoxGeometry(wingSpan, STARMIND_HEIGHT_M, WING_CHORD_M);
  const left = new Mesh(wingGeometry, wingMaterial);
  left.position.x = -(BUS_WIDTH_M / 2 + wingSpan / 2);
  const right = new Mesh(wingGeometry, wingMaterial);
  right.position.x = BUS_WIDTH_M / 2 + wingSpan / 2;
  const radiatorMaterial = new MeshStandardMaterial({ color: 0xc5ccd2, metalness: 0.82, roughness: 0.22 });
  const radiatorGeometry = new BoxGeometry(RADIATOR_PANEL_M.width, RADIATOR_PANEL_M.height, 0.4);
  const radiatorA = new Mesh(radiatorGeometry, radiatorMaterial);
  radiatorA.position.set(0, 0, BUS_DEPTH_M / 2 + 0.4);
  const radiatorB = new Mesh(radiatorGeometry, radiatorMaterial);
  radiatorB.position.set(0, 0, -(BUS_DEPTH_M / 2 + 0.4));
  group.add(bus, left, right, radiatorA, radiatorB);
  group.scale.setScalar(ILLUSTRATIVE_WINGSPAN_KM / STARMIND_WINGSPAN_M);
  return group;
}
