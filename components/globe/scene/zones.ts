import * as THREE from "three";

import { geodeticToScene } from "@/lib/engine/globe/frames";
import { protonLayer, SAA_EDGE_LOG, type ProtonMap } from "@/lib/engine/globe/protonMap";
import { DIPOLE_POLE_LAT_DEG, DIPOLE_POLE_LON_DEG } from "@/lib/engine/orbit/stormZones";

// Zone layers on the rotating Earth. Each fragment works out its own latitude, longitude or magnetic latitude,
// so edges stay smooth and nothing pinches at the poles. The edges use the same formulas as the point tests in
// lib/engine (inSaaFlux, inAuroralOval, inSepCap), so the drawing and the HUD badges agree.
// Colours are written as display (sRGB) values, so these shaders skip the colour-space conversion.

export type TrackPoint = { latDeg: number; lonDeg: number };

/** Shell radii in Earth radii. The aurora sits at about 110 km, where the green emission peaks. */
const SAA_RADIUS = 1.0035;
const SEP_RADIUS = 1.005;
const AURORA_RADIUS = 1 + 110 / 6378.137;

const shellVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** lat/lon in radians from a scene-frame direction (see lib/engine/globe/frames.ts), and equirectangular uv. */
const geoChunk = /* glsl */ `
  const float PI = 3.141592653589793;
  vec2 latLon(vec3 d) {
    return vec2(asin(clamp(d.y, -1.0, 1.0)), atan(-d.z, d.x));
  }
  vec2 equirect(vec2 ll) {
    return vec2(ll.y / (2.0 * PI) + 0.5, ll.x / PI + 0.5);
  }
`;

const saaFragment = /* glsl */ `
  uniform sampler2D fluxMap;
  uniform float edge;
  uniform float top;
  uniform float decade;
  ${geoChunk}
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float v = texture2D(fluxMap, equirect(latLon(d))).r;
    float inside = smoothstep(edge - 0.003, edge + 0.003, v);
    float t = clamp((v - edge) / max(top - edge, 1e-3), 0.0, 1.0);
    vec3 color = mix(vec3(1.0, 0.72, 0.28), vec3(0.95, 0.16, 0.36), t);
    float alpha = inside * (0.14 + 0.36 * t);
    // A faint halo one decade below the edge, so the contour reads as part of a field, not a cut-out.
    alpha += smoothstep(edge - decade, edge, v) * (1.0 - inside) * 0.08;
    // smoothstep(0, 0, x) is undefined in GLSL, and fwidth is 0 wherever the map is flat, so keep a minimum width.
    float line = 1.0 - smoothstep(0.0, max(1.5 * fwidth(v), 1e-4), abs(v - edge));
    color = mix(color, vec3(1.0, 0.45, 0.5), line);
    gl_FragColor = vec4(color, max(alpha, line * 0.95));
  }
`;

const auroraFragment = /* glsl */ `
  uniform vec3 dipoleAxis;
  uniform float eqEdge;
  uniform float poleEdge;
  uniform float strength;
  uniform float useOvation;
  uniform sampler2D ovation;
  ${geoChunk}
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float mlat = abs(degrees(asin(clamp(dot(d, dipoleAxis), -1.0, 1.0))));
    float band = smoothstep(eqEdge - 1.2, eqEdge + 0.8, mlat) * (1.0 - smoothstep(poleEdge - 0.8, poleEdge + 1.2, mlat));
    float across = clamp((mlat - eqEdge) / max(poleEdge - eqEdge, 1.0), 0.0, 1.0);
    vec3 color = mix(vec3(0.24, 1.0, 0.55), vec3(0.85, 0.30, 0.55), smoothstep(0.55, 1.0, across) * 0.55);
    float probability = texture2D(ovation, equirect(latLon(d))).r;
    float fromOvation = smoothstep(0.03, 0.35, probability) * (0.35 + 0.65 * probability);
    float alpha = mix(band * strength, fromOvation, useOvation);
    gl_FragColor = vec4(color * alpha, alpha);
  }
`;

const sepFragment = /* glsl */ `
  uniform vec3 dipoleAxis;
  uniform float cutoff;
  uniform float intensity;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float mlat = abs(degrees(asin(clamp(dot(d, dipoleAxis), -1.0, 1.0))));
    float cap = smoothstep(cutoff - 1.0, cutoff + 1.0, mlat);
    float line = 1.0 - smoothstep(0.0, max(1.5 * fwidth(mlat), 1e-4), abs(mlat - cutoff));
    gl_FragColor = vec4(vec3(1.0, 0.37, 0.82), max(cap * intensity, line * 0.9 * step(0.001, intensity)));
  }
`;

function shell(radius: number, material: THREE.ShaderMaterial, name: string, renderOrder: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 128, 96), material);
  mesh.name = name;
  mesh.renderOrder = renderOrder;
  return mesh;
}

function dipoleAxis(): THREE.Vector3 {
  const pole = geodeticToScene(DIPOLE_POLE_LAT_DEG, DIPOLE_POLE_LON_DEG, 0);
  return new THREE.Vector3(pole.x, pole.y, pole.z).normalize();
}

export interface SaaLayer {
  mesh: THREE.Mesh;
  /** Re-slice the map at a new altitude. */
  setAltitude: (altKm: number) => void;
  dispose: () => void;
}

export function createSaaLayer(map: ProtonMap): SaaLayer {
  const { latCount, lonCount, encoding } = map.file;
  const span = encoding.logCeil - encoding.logFloor;
  const values = new Float32Array(latCount * lonCount);
  // Half floats, not bytes: an 8-bit texture can be filtered at 8-bit precision, which terraces the contour.
  const halves = new Uint16Array(latCount * lonCount);
  const texture = new THREE.DataTexture(halves, lonCount, latCount, THREE.RedFormat, THREE.HalfFloatType);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const uniforms = {
    fluxMap: { value: texture },
    edge: { value: (SAA_EDGE_LOG - encoding.logFloor) / span },
    top: { value: 1 },
    decade: { value: 1 / span },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: shellVertex,
    fragmentShader: saaFragment,
    transparent: true,
    depthWrite: false,
  });
  const mesh = shell(SAA_RADIUS, material, "saa", 2);
  let lastAlt = Number.NaN;
  return {
    mesh,
    setAltitude: (altKm) => {
      if (Math.abs(altKm - lastAlt) < 1) {
        return;
      }
      lastAlt = altKm;
      protonLayer(map, altKm, values);
      let max = 0;
      for (let index = 0; index < values.length; index += 1) {
        max = Math.max(max, values[index]);
        halves[index] = THREE.DataUtils.toHalfFloat(values[index]);
      }
      uniforms.top.value = max;
      texture.needsUpdate = true;
    },
    dispose: () => {
      mesh.geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}

export interface AuroraLayer {
  mesh: THREE.Mesh;
  /** Kp-model band between two magnetic latitudes, degrees. */
  setBand: (equatorwardDeg: number, polewardDeg: number, kp: number) => void;
  /** Live OVATION probabilities ([lon 0..359, lat -90..90, percent]); null switches back to the Kp model. */
  setOvation: (points: [number, number, number][] | null) => void;
  dispose: () => void;
}

const OVATION_W = 360;
const OVATION_H = 181;

export function createAuroraLayer(): AuroraLayer {
  const bytes = new Uint8Array(OVATION_W * OVATION_H);
  const texture = new THREE.DataTexture(bytes, OVATION_W, OVATION_H, THREE.RedFormat, THREE.UnsignedByteType);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const uniforms = {
    dipoleAxis: { value: dipoleAxis() },
    eqEdge: { value: 62 },
    poleEdge: { value: 74 },
    strength: { value: 0.45 },
    useOvation: { value: 0 },
    ovation: { value: texture },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: shellVertex,
    fragmentShader: auroraFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = shell(AURORA_RADIUS, material, "aurora", 3);
  return {
    mesh,
    setBand: (equatorwardDeg, polewardDeg, kp) => {
      uniforms.eqEdge.value = equatorwardDeg;
      uniforms.poleEdge.value = polewardDeg;
      // Brighter in stronger storms. A display choice, not an emission model.
      uniforms.strength.value = Math.min(0.85, 0.35 + 0.055 * Math.max(0, kp));
    },
    setOvation: (points) => {
      if (!points) {
        uniforms.useOvation.value = 0;
        return;
      }
      bytes.fill(0);
      for (const [lon, lat, percent] of points) {
        const column = (Math.round(lon) + 180 + 360) % 360;
        const row = Math.round(lat) + 90;
        if (row >= 0 && row < OVATION_H) {
          bytes[row * OVATION_W + column] = Math.round(Math.min(100, Math.max(0, percent)) * 2.55);
        }
      }
      texture.needsUpdate = true;
      uniforms.useOvation.value = 1;
    },
    dispose: () => {
      mesh.geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}

export interface SepLayer {
  mesh: THREE.Mesh;
  /** Cutoff magnetic latitude and the >10 MeV flux; below S1 the cap is not drawn. */
  setEvent: (cutoffDeg: number, protonPfu: number | null) => void;
  dispose: () => void;
}

export function createSepLayer(): SepLayer {
  const uniforms = {
    dipoleAxis: { value: dipoleAxis() },
    cutoff: { value: 64 },
    intensity: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: shellVertex,
    fragmentShader: sepFragment,
    transparent: true,
    depthWrite: false,
  });
  const mesh = shell(SEP_RADIUS, material, "proton-cap", 2);
  return {
    mesh,
    setEvent: (cutoffDeg, protonPfu) => {
      uniforms.cutoff.value = cutoffDeg;
      // Opacity grows one step per NOAA S level (S1 10 pfu ... S5 100,000 pfu). A display choice.
      uniforms.intensity.value =
        protonPfu === null || protonPfu < 10 ? 0 : Math.min(0.5, 0.16 + 0.08 * (Math.log10(protonPfu) - 1));
    },
    dispose: () => {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}

/** Lookup for the live OVATION points that pass the display cutoff, used to classify the craft and track. */
export function ovationLookup(points: TrackPoint[]): (latDeg: number, lonDeg: number) => boolean {
  const cells = new Set(points.map((point) => `${Math.round(point.latDeg)}|${(Math.round(point.lonDeg) + 360) % 360}`));
  return (latDeg, lonDeg) => cells.has(`${Math.round(latDeg)}|${(Math.round(lonDeg) + 360) % 360}`);
}
