import * as THREE from "three";

/** Earth radius is the scene unit. */
const SEGMENTS_W = 128;
const SEGMENTS_H = 64;
/** Shell radius of the atmosphere glow, in Earth radii. Exaggerated for visibility (real haze is about 1.016). */
const ATMOSPHERE_RADIUS = 1.06;
/** Where Earth's limb falls on the shell's back faces: -dot(normal, view) at the limb = sqrt(1 - 1/R^2). */
const LIMB_DOT = Math.sqrt(1 - 1 / (ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS));

const earthVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPositionW = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const earthFragment = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform float hasDay;
  uniform float hasNight;
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPositionW;

  void main() {
    vec3 n = normalize(vNormalW);
    vec3 viewDir = normalize(cameraPosition - vPositionW);
    float ndl = dot(n, sunDirection);

    // Placeholder ocean colour until the day map has loaded.
    vec3 day = mix(vec3(0.015, 0.03, 0.06), texture2D(dayMap, vUv).rgb, hasDay);
    vec3 night = texture2D(nightMap, vUv).rgb * hasNight;

    // Soft terminator: civil-twilight-wide blend instead of a hard edge.
    float lit = smoothstep(-0.10, 0.18, ndl);
    vec3 color = day * (0.02 + 1.15 * max(ndl, 0.0) + 0.10 * lit);

    // Ocean glint: blue-dominant pixels of the day map act as the water mask.
    float ocean = smoothstep(0.015, 0.08, day.b - max(day.r, day.g));
    vec3 halfDir = normalize(sunDirection + viewDir);
    float glint = pow(max(dot(n, halfDir), 0.0), 70.0) * ocean * step(0.0, ndl);
    color += vec3(1.0, 0.92, 0.8) * glint * 0.55;

    // Night side: the night image is a dim moonlit Earth with warm city lights on top. Lights are the pixels where
    // red beats blue; they are boosted, the blue base is kept faint so the continents just read.
    float cityMask = smoothstep(0.01, 0.10, night.r - night.b * 0.85);
    vec3 nightColor = night * 0.32 + night * cityMask * 2.4;
    color += nightColor * (1.0 - lit);

    // Blue haze towards the limb on the day side.
    float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    color += vec3(0.30, 0.55, 1.0) * rim * 0.55 * smoothstep(-0.25, 0.35, ndl);

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const atmosphereVertex = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPositionW = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const atmosphereFragment = /* glsl */ `
  uniform vec3 sunDirection;
  uniform float limbDot;
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  void main() {
    vec3 n = normalize(vNormalW);
    vec3 viewDir = normalize(cameraPosition - vPositionW);
    // Back faces of the shell: brightest at Earth's limb, fading to nothing at the shell's outer edge.
    float limb = pow(clamp(-dot(n, viewDir) / limbDot, 0.0, 1.0), 3.0);
    float day = smoothstep(-0.35, 0.4, dot(n, sunDirection));
    vec3 color = vec3(0.30, 0.58, 1.0) * limb * (0.12 + 0.88 * day);
    gl_FragColor = vec4(color, limb);
    #include <colorspace_fragment>
  }
`;

export interface EarthLayer {
  /** Add this to the scene: the rotating Earth plus the non-rotating atmosphere shell. */
  root: THREE.Group;
  /** Rotates with the Earth (GMST). Anything Earth-fixed goes inside it. */
  group: THREE.Group;
  setSunDirection: (direction: THREE.Vector3) => void;
  dispose: () => void;
}

/** onReady runs once the day map has loaded, i.e. when the Earth stops being a placeholder. */
export function createEarth(onReady?: () => void): EarthLayer {
  const group = new THREE.Group();
  const sunDirection = new THREE.Vector3(1, 0, 0);
  const uniforms = {
    dayMap: { value: null as THREE.Texture | null },
    nightMap: { value: null as THREE.Texture | null },
    hasDay: { value: 0 },
    hasNight: { value: 0 },
    sunDirection: { value: sunDirection },
  };
  const geometry = new THREE.SphereGeometry(1, SEGMENTS_W, SEGMENTS_H);
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: earthVertex, fragmentShader: earthFragment });
  const earth = new THREE.Mesh(geometry, material);
  earth.name = "earth";
  group.add(earth);

  const atmosphereGeometry = new THREE.SphereGeometry(ATMOSPHERE_RADIUS, 96, 48);
  const atmosphereMaterial = new THREE.ShaderMaterial({
    uniforms: { sunDirection: uniforms.sunDirection, limbDot: { value: LIMB_DOT } },
    vertexShader: atmosphereVertex,
    fragmentShader: atmosphereFragment,
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  // The shell is a sphere around the centre, so it does not need to rotate; it sits outside the Earth group.
  const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
  atmosphere.name = "atmosphere";

  const loader = new THREE.TextureLoader();
  const textures: THREE.Texture[] = [];
  const load = (url: string, onLoad: (texture: THREE.Texture) => void) => {
    loader.load(url, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      textures.push(texture);
      onLoad(texture);
    });
  };
  load("/globe/earth-day.jpg", (texture) => {
    uniforms.dayMap.value = texture;
    uniforms.hasDay.value = 1;
    onReady?.();
  });
  load("/globe/earth-night.jpg", (texture) => {
    uniforms.nightMap.value = texture;
    uniforms.hasNight.value = 1;
  });

  const root = new THREE.Group();
  root.add(group);
  root.add(atmosphere);

  return {
    root,
    group,
    setSunDirection: (direction) => {
      sunDirection.copy(direction).normalize();
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
      atmosphereGeometry.dispose();
      atmosphereMaterial.dispose();
      for (const texture of textures) {
        texture.dispose();
      }
    },
  };
}
