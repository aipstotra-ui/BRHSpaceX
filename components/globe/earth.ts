import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  Float32BufferAttribute,
  FrontSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from "three";

import { saaBit, saaGrid, saaRings } from "@/lib/engine/saaContour";
import { EARTH_RADIUS_KM, latLngAltToKm } from "@/lib/globe/spherical";

export const earthVertex = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const earthFragment = `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 sun = normalize(sunDirection);
    float lambert = dot(normal, sun);
    float day = smoothstep(-0.12, 0.22, lambert);
    vec3 dayColor = texture2D(dayMap, vUv).rgb;
    vec3 nightColor = texture2D(nightMap, vUv).rgb * 0.85;
    vec3 color = mix(nightColor, dayColor, day);
    vec3 viewDir = normalize(cameraPosition - vWorld);
    vec3 halfDir = normalize(sun + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 48.0) * day;
    color += spec * 0.18;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export const atmosphereFragment = `
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), viewDir)), 2.4);
    gl_FragColor = vec4(0.306, 0.757, 0.961, fresnel * 0.9);
  }
`;

export function createEarthMaterial(day: CanvasTexture | import("three").Texture, night: import("three").Texture): ShaderMaterial {
  day.colorSpace = SRGBColorSpace;
  night.colorSpace = SRGBColorSpace;
  day.anisotropy = 8;
  night.anisotropy = 8;
  return new ShaderMaterial({
    uniforms: {
      dayMap: { value: day },
      nightMap: { value: night },
      sunDirection: { value: new Vector3(1, 0.15, 0.2).normalize() },
    },
    vertexShader: earthVertex,
    fragmentShader: earthFragment,
  });
}

export function createAtmosphere(radiusKm: number): Mesh {
  const material = new ShaderMaterial({
    vertexShader: earthVertex,
    fragmentShader: atmosphereFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: FrontSide,
  });
  return new Mesh(new SphereGeometry(radiusKm * 1.028, 64, 64), material);
}

export function createGraticule(): LineSegments {
  const positions: number[] = [];
  const push = (lat: number, lon: number) => {
    positions.push(...latLngAltToKm(lat, lon, 18));
  };
  for (let lat = -60; lat <= 60; lat += 30) {
    for (let lon = -180; lon < 180; lon += 4) {
      push(lat, lon);
      push(lat, Math.min(180, lon + 4));
    }
  }
  for (let lon = -180; lon < 180; lon += 30) {
    for (let lat = -90; lat < 90; lat += 4) {
      push(lat, lon);
      push(Math.min(90, lat + 4), lon);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return new LineSegments(geometry, new LineBasicMaterial({ color: 0x2c2f33 }));
}

export function createSaaFill(altitudeKm: number): Mesh {
  const grid = saaGrid(altitudeKm);
  const canvas = document.createElement("canvas");
  canvas.width = grid.nLon;
  canvas.height = grid.nLat;
  const context = canvas.getContext("2d");
  if (context) {
    const image = context.createImageData(grid.nLon, grid.nLat);
    for (let y = 0; y < grid.nLat; y += 1) {
      const latIndex = grid.nLat - 1 - y;
      for (let x = 0; x < grid.nLon; x += 1) {
        if (!saaBit(grid, latIndex, x)) {
          continue;
        }
        const offset = (y * grid.nLon + x) * 4;
        image.data[offset] = 255;
        image.data[offset + 1] = 106;
        image.data[offset + 2] = 69;
        image.data[offset + 3] = 88;
      }
    }
    context.putImageData(image, 0, 0);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    color: new Color(0xffffff),
  });
  const mesh = new Mesh(new SphereGeometry(EARTH_RADIUS_KM + 28, 64, 64), material);
  mesh.name = "saa-fill";
  mesh.userData.texture = texture;
  return mesh;
}

export function createSaaRings(altitudeKm: number): Group {
  const group = new Group();
  group.name = "saa-rings";
  for (const ring of saaRings(altitudeKm)) {
    const positions = new Float32Array(ring.length * 3);
    for (let index = 0; index < ring.length; index += 1) {
      const lon = ring[index][0];
      const lat = ring[index][1];
      const [x, y, z] = latLngAltToKm(lat, lon, 36);
      positions[index * 3] = x;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = z;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    group.add(new LineSegments(geometry, new LineBasicMaterial({ color: 0xff6a45 })));
    const linePositions: number[] = [];
    for (let index = 0; index < ring.length - 1; index += 1) {
      linePositions.push(positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]);
      linePositions.push(positions[(index + 1) * 3], positions[(index + 1) * 3 + 1], positions[(index + 1) * 3 + 2]);
    }
    geometry.setAttribute("position", new Float32BufferAttribute(linePositions, 3));
  }
  return group;
}
