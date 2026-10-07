// Builds public/models/starmind.glb, the spacecraft drawn on the globe.
//   node scripts/models/build-starmind.mjs
//
// Self-authored, illustrative geometry. Sourced numbers (https://www.spacex.com/spacexai/starmind, see
// docs/research/reference-values.md): 75 m wingspan, 30 m height, 160 m² radiator, and 840 m² of solar array
// (210 kW at 250 W/m²). Every other dimension is an estimate chosen to meet those totals.
//
// Metallic factors are kept moderate because the globe lights the craft without a reflection map.
// Units are metres. Body axes: +X along the velocity, +Y zenith (the phased array faces -Y, nadir), +Z = X × Y,
// which is along the orbit-normal axis. The wings lie along ±Z and turn about Z on the nodes "WingPivot+" and "WingPivot-"; at rotation 0 their
// cells face +Y.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";

import { Document, NodeIO } from "@gltf-transform/core";
import * as THREE from "three";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = resolve(ROOT, "public/models/starmind.glb");

const WINGSPAN_M = 75;
const HEIGHT_M = 30;
const RADIATOR_M2 = 160;
const SOLAR_M2 = 840;

// Estimates (not published): bus 8 m × 6 m × 8 m, 1.5 m booms, radiators as two 4 m wide panels.
const BUS = { x: 8, y: 6, z: 8 };
const BOOM_M = 1.5;
const WING_LENGTH_M = WINGSPAN_M / 2 - BUS.z / 2 - BOOM_M; // 32 m each
const WING_CHORD_M = SOLAR_M2 / 2 / WING_LENGTH_M; // 13.125 m, from the sourced array area
const RADIATOR_WIDTH_M = 4;
const RADIATOR_HEIGHT_M = RADIATOR_M2 / 2 / RADIATOR_WIDTH_M; // two panels, 80 m² each
const RADIATOR_BASE_Y = BUS.y / 2 + 0.5;
const MAST_TOP_Y = HEIGHT_M - BUS.y / 2; // top of the mast, so nadir face to top is HEIGHT_M

// ---------- tiny PNG encoder (RGB, 8 bit) ----------
function png(width, height, pixel) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixel(x, y);
      const at = y * (width * 3 + 1) + 1 + x * 3;
      raw[at] = r;
      raw[at + 1] = g;
      raw[at + 2] = b;
    }
  }
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// One tile = 2 m × 2 m of array: 4 × 4 cells, thin silver bus bars, a darker gap round the edge.
const cellsPng = png(256, 256, (x, y) => {
  const cx = x % 64;
  const cy = y % 64;
  const edge = x < 2 || y < 2 || x > 253 || y > 253;
  if (edge) {
    return [28, 32, 40];
  }
  if (cx < 2 || cy < 2) {
    return [150, 160, 172];
  }
  if (cx % 16 === 8) {
    return [70, 82, 104];
  }
  const shade = (hash(Math.floor(x / 64), Math.floor(y / 64)) - 0.5) * 10;
  return [16 + shade, 34 + shade, 72 + shade * 1.5];
});

// Phased-array tiles on the nadir face.
const arrayPng = png(128, 128, (x, y) => {
  const cx = x % 16;
  const cy = y % 16;
  if (cx < 2 || cy < 2) {
    return [34, 37, 42];
  }
  const shade = (hash(Math.floor(x / 16), Math.floor(y / 16)) - 0.5) * 12;
  return [78 + shade, 84 + shade, 92 + shade];
});

// Gold multi-layer insulation: crinkled, so brightness varies in streaks.
const mliPng = png(128, 128, (x, y) => {
  const n = hash(Math.floor(x / 3), Math.floor(y / 7)) * 0.6 + hash(Math.floor(x / 9), Math.floor(y / 4)) * 0.4;
  const v = 0.78 + 0.32 * n;
  return [Math.min(255, 214 * v), Math.min(255, 160 * v), Math.min(255, 72 * v)];
});

// ---------- glTF document ----------
const doc = new Document();
const buffer = doc.createBuffer();

function texture(name, bytes) {
  return doc.createTexture(name).setImage(bytes).setMimeType("image/png");
}

const cellsTexture = texture("cells", cellsPng);
const arrayTexture = texture("phased-array", arrayPng);
const mliTexture = texture("mli", mliPng);

const materials = {
  cells: doc
    .createMaterial("SolarCells")
    .setBaseColorTexture(cellsTexture)
    .setMetallicFactor(0.15)
    .setRoughnessFactor(0.35),
  wingBack: doc.createMaterial("WingBack").setBaseColorFactor([0.62, 0.64, 0.66, 1]).setMetallicFactor(0.1).setRoughnessFactor(0.7),
  mli: doc.createMaterial("MLIGold").setBaseColorTexture(mliTexture).setMetallicFactor(0.35).setRoughnessFactor(0.45),
  array: doc.createMaterial("PhasedArray").setBaseColorTexture(arrayTexture).setMetallicFactor(0.3).setRoughnessFactor(0.6),
  radiator: doc.createMaterial("RadiatorWhite").setBaseColorFactor([0.9, 0.91, 0.92, 1]).setMetallicFactor(0).setRoughnessFactor(0.55),
  structure: doc.createMaterial("Aluminium").setBaseColorFactor([0.72, 0.74, 0.77, 1]).setMetallicFactor(0.5).setRoughnessFactor(0.45),
};

/** One three.js geometry as a glTF mesh with a single primitive. UVs can be scaled so textures tile. */
function mesh(name, geometry, material, uvScale = [1, 1]) {
  const indexed = geometry.index ? geometry : geometry.setIndex([...Array(geometry.attributes.position.count).keys()]);
  const position = doc
    .createAccessor(`${name}-position`)
    .setType("VEC3")
    .setArray(new Float32Array(indexed.attributes.position.array))
    .setBuffer(buffer);
  const normal = doc
    .createAccessor(`${name}-normal`)
    .setType("VEC3")
    .setArray(new Float32Array(indexed.attributes.normal.array))
    .setBuffer(buffer);
  const uvs = new Float32Array(indexed.attributes.uv.array);
  for (let index = 0; index < uvs.length; index += 2) {
    uvs[index] *= uvScale[0];
    uvs[index + 1] *= uvScale[1];
  }
  const uv = doc.createAccessor(`${name}-uv`).setType("VEC2").setArray(uvs).setBuffer(buffer);
  const indices = doc
    .createAccessor(`${name}-indices`)
    .setType("SCALAR")
    .setArray(new Uint16Array(indexed.index.array))
    .setBuffer(buffer);
  const primitive = doc
    .createPrimitive()
    .setAttribute("POSITION", position)
    .setAttribute("NORMAL", normal)
    .setAttribute("TEXCOORD_0", uv)
    .setIndices(indices)
    .setMaterial(material);
  return doc.createMesh(name).addPrimitive(primitive);
}

function node(name, meshValue, translation = [0, 0, 0]) {
  const value = doc.createNode(name).setTranslation(translation);
  if (meshValue) {
    value.setMesh(meshValue);
  }
  return value;
}

const root = doc.createNode("Starmind");
doc.createScene("Starmind").addChild(root);

root.addChild(node("Bus", mesh("Bus", new THREE.BoxGeometry(BUS.x, BUS.y, BUS.z), materials.mli, [2, 2])));

const arrayFace = new THREE.PlaneGeometry(BUS.x - 0.6, BUS.z - 0.6).rotateX(Math.PI / 2);
root.addChild(node("PhasedArray", mesh("PhasedArray", arrayFace, materials.array, [3, 3]), [0, -BUS.y / 2 - 0.02, 0]));

const mastLength = MAST_TOP_Y - BUS.y / 2;
root.addChild(
  node("Mast", mesh("Mast", new THREE.BoxGeometry(0.5, mastLength, 0.5), materials.structure), [0, BUS.y / 2 + mastLength / 2, 0]),
);
for (const side of [1, -1]) {
  const panel = new THREE.BoxGeometry(RADIATOR_WIDTH_M, RADIATOR_HEIGHT_M, 0.15);
  root.addChild(
    node(
      `Radiator${side > 0 ? "+" : "-"}`,
      mesh(`Radiator${side > 0 ? "+" : "-"}`, panel, materials.radiator),
      [side * (RADIATOR_WIDTH_M / 2 + 0.3), RADIATOR_BASE_Y + RADIATOR_HEIGHT_M / 2, 0],
    ),
  );
}

for (const side of [1, -1]) {
  const tag = side > 0 ? "+" : "-";
  const pivot = node(`WingPivot${tag}`, null, [0, 0, (side * BUS.z) / 2]);
  const boom = new THREE.BoxGeometry(0.35, 0.35, BOOM_M);
  pivot.addChild(node(`Boom${tag}`, mesh(`Boom${tag}`, boom, materials.structure), [0, 0, (side * BOOM_M) / 2]));
  const centre = side * (BOOM_M + WING_LENGTH_M / 2);
  // PlaneGeometry faces +Z; rotating -90° about X makes it face +Y (zenith) with its length along Z.
  const front = new THREE.PlaneGeometry(WING_CHORD_M, WING_LENGTH_M).rotateX(-Math.PI / 2);
  const back = new THREE.PlaneGeometry(WING_CHORD_M, WING_LENGTH_M).rotateX(Math.PI / 2);
  pivot.addChild(
    node(`Wing${tag}`, mesh(`Wing${tag}`, front, materials.cells, [WING_CHORD_M / 2, WING_LENGTH_M / 2]), [0, 0.04, centre]),
  );
  pivot.addChild(node(`WingBack${tag}`, mesh(`WingBack${tag}`, back, materials.wingBack), [0, -0.04, centre]));
  const frame = new THREE.BoxGeometry(WING_CHORD_M + 0.3, 0.12, 0.3);
  for (const end of [-1, 1]) {
    pivot.addChild(
      node(`WingFrame${tag}${end > 0 ? "a" : "b"}`, mesh(`WingFrame${tag}${end}`, frame, materials.structure), [
        0,
        0,
        centre + end * (WING_LENGTH_M / 2 - 0.15), // inside the panel end, so the tips stay at 37.5 m
      ]),
    );
  }
  root.addChild(pivot);
}

root.setExtras({
  units: "m",
  axes: "+X velocity, +Y zenith, +Z = X x Y (orbit-normal axis); wings turn about Z on WingPivot+/-",
  sourced: { wingspanM: WINGSPAN_M, heightM: HEIGHT_M, radiatorM2: RADIATOR_M2, solarM2: SOLAR_M2 },
  estimates: { bus: BUS, boomM: BOOM_M, wingChordM: WING_CHORD_M, radiatorWidthM: RADIATOR_WIDTH_M },
  license: "Self-authored for this project; see public/models/README.md",
});

const io = new NodeIO();
const glb = await io.writeBinary(doc);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, glb);
console.log(
  `wrote ${OUT} (${(glb.byteLength / 1024).toFixed(0)} KB): wingspan ${WINGSPAN_M} m, chord ${WING_CHORD_M.toFixed(3)} m, ` +
    `radiators 2 × ${RADIATOR_WIDTH_M} × ${RADIATOR_HEIGHT_M} m, height ${HEIGHT_M} m`,
);
