import * as THREE from "three";

/** Decorative only: random points on a far sphere, not a star catalogue. Seeded so every load looks the same. */
const STAR_COUNT = 2400;
const STAR_RADIUS = 60;

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createStars(): THREE.Points {
  const random = mulberry32(3_2017_2024);
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  for (let index = 0; index < STAR_COUNT; index += 1) {
    const z = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const ring = Math.sqrt(1 - z * z);
    positions[index * 3] = STAR_RADIUS * ring * Math.cos(angle);
    positions[index * 3 + 1] = STAR_RADIUS * z;
    positions[index * 3 + 2] = STAR_RADIUS * ring * Math.sin(angle);
    // Most stars faint, a few bright; slight warm/cool tint.
    const brightness = 0.12 + 0.55 * random() ** 4;
    const warm = random() - 0.5;
    colors[index * 3] = brightness * (1 + 0.15 * warm);
    colors[index * 3 + 1] = brightness;
    colors[index * 3 + 2] = brightness * (1 - 0.15 * warm);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 1.4,
    sizeAttenuation: false,
    vertexColors: true,
    depthWrite: false,
    toneMapped: false,
  });
  const stars = new THREE.Points(geometry, material);
  stars.name = "stars";
  stars.renderOrder = -1;
  return stars;
}
