"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  AmbientLight,
  BufferGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from "three";

import { aimVehicle, attachCameraControls, followStarmind, placeCamera } from "@/components/globe/CameraControls";
import { createAtmosphere, createEarthMaterial, createGraticule, createSaaFill, createSaaRings } from "@/components/globe/earth";
import { createOrbitTrail, writeOrbitTrail } from "@/components/globe/OrbitTrail";
import { hexToRgb, shellColorHex } from "@/components/globe/palette";
import { createStarmindModel } from "@/components/globe/StarmindModel";
import { GroundTrack2D } from "@/components/globe/GroundTrack2D";
import { PLAYBACK_RATE, SCRUB_WINDOW_S, useGlobeSim, type GlobeSample } from "@/components/globe/useGlobeSim";
import { nearestSaaAltitudeKm, SAA_THRESHOLD_NT } from "@/lib/engine/saaContour";
import { sunUnit } from "@/lib/engine/orbit/sun";
import { auroraProxyPoints } from "@/lib/globe/aurora";
import { EARTH_RADIUS_KM, latLngAltToKm, orbitRadiusKm } from "@/lib/globe/spherical";
import { starlinkDemo, starlinkRecords } from "@/lib/globe/starlinkDemo";

const sunScratch = new Vector3();
const vehicleTarget = new Vector3();
const vehiclePrevious = new Vector3();

function sceneSun(epochMs: number, target: Vector3): Vector3 {
  const days = epochMs / 86_400_000 - 10_957.5;
  const lambda = (280.46 + 0.9856474 * days) % 360;
  const sun = sunUnit(lambda < 0 ? lambda + 360 : lambda);
  return target.set(sun.x, sun.z, sun.y).normalize();
}

function disposeObject(object: Object3D): void {
  object.traverse((child) => {
    const mesh = child as Mesh;
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((entry) => entry.dispose());
    } else {
      material?.dispose();
    }
  });
}

function GlobeView({
  sampleRef,
  drawnAltitudeKm,
  follow,
  zoomKm,
  onMedian,
  onUnavailable,
}: {
  sampleRef: RefObject<GlobeSample>;
  drawnAltitudeKm: number;
  follow: boolean;
  zoomKm: number;
  onMedian: (fps: number) => void;
  onUnavailable: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(follow);
  const zoomRef = useRef({ km: zoomKm, dirty: true });
  const altitudeRef = useRef(drawnAltitudeKm);
  const onMedianRef = useRef(onMedian);
  const onUnavailableRef = useRef(onUnavailable);
  useEffect(() => {
    followRef.current = follow;
    altitudeRef.current = drawnAltitudeKm;
    onMedianRef.current = onMedian;
    onUnavailableRef.current = onUnavailable;
  }, [drawnAltitudeKm, follow, onMedian, onUnavailable]);

  useEffect(() => {
    zoomRef.current = { km: zoomKm, dirty: true };
  }, [zoomKm]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch {
      onUnavailableRef.current();
      return;
    }
    if (!renderer.getContext()) {
      renderer.dispose();
      onUnavailableRef.current();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 1);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);

    const scene = new Scene();
    const camera = new PerspectiveCamera(32, 1, 10, 120_000);
    camera.position.set(11_000, 7_000, 14_000);
    const controls = attachCameraControls(camera, renderer.domElement);
    scene.add(new AmbientLight(0xffffff, 0.35));
    scene.add(new HemisphereLight(0x8fb7d6, 0x1a1208, 0.35));
    const sunLight = new DirectionalLight(0xfff4e0, 1.45);
    scene.add(sunLight);

    const stars = new Float32Array(450 * 3);
    for (let index = 0; index < 450; index += 1) {
      const radius = 52_000;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      stars[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      stars[index * 3 + 1] = radius * Math.cos(phi);
      stars[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const starGeometry = new BufferGeometry();
    starGeometry.setAttribute("position", new Float32BufferAttribute(stars, 3));
    scene.add(new Points(starGeometry, new PointsMaterial({ color: 0xb8bcc1, size: 1.4, sizeAttenuation: false })));

    const earthAnchor = new Group();
    scene.add(earthAnchor);
    const saaAnchor = new Group();
    scene.add(saaAnchor);
    scene.add(createGraticule());

    const records = starlinkRecords();
    const starPositions = new Float32Array(records.length * 3);
    const starColors = new Float32Array(records.length * 3);
    records.forEach((record, index) => {
      const [red, green, blue] = hexToRgb(shellColorHex(record.shellDeg, record.raisingOrDeorbiting));
      starColors[index * 3] = red;
      starColors[index * 3 + 1] = green;
      starColors[index * 3 + 2] = blue;
    });
    const starlinkGeometry = new BufferGeometry();
    starlinkGeometry.setAttribute("position", new Float32BufferAttribute(starPositions, 3));
    starlinkGeometry.setAttribute("color", new Float32BufferAttribute(starColors, 3));
    scene.add(
      new Points(
        starlinkGeometry,
        new PointsMaterial({ size: 2.6, vertexColors: true, sizeAttenuation: false, depthWrite: false }),
      ),
    );

    const aurora = auroraProxyPoints();
    const auroraPositions = new Float32Array(Math.max(aurora.length, 1) * 3);
    const auroraColors = new Float32Array(Math.max(aurora.length, 1) * 3);
    aurora.forEach((point, index) => {
      auroraPositions.set(latLngAltToKm(point.latDeg, point.lonDeg, 80), index * 3);
      const gain = Math.min(1, point.aurora / 13);
      auroraColors[index * 3] = 0.31;
      auroraColors[index * 3 + 1] = 0.55 + gain * 0.35;
      auroraColors[index * 3 + 2] = 0.96;
    });
    const auroraGeometry = new BufferGeometry();
    auroraGeometry.setAttribute("position", new Float32BufferAttribute(auroraPositions, 3));
    auroraGeometry.setAttribute("color", new Float32BufferAttribute(auroraColors, 3));
    scene.add(
      new Points(
        auroraGeometry,
        new PointsMaterial({
          size: 3.2,
          vertexColors: true,
          sizeAttenuation: false,
          depthWrite: false,
          transparent: true,
          opacity: 0.9,
        }),
      ),
    );

    const trail = createOrbitTrail();
    scene.add(trail);
    const vehicle = createStarmindModel();
    scene.add(vehicle);
    scene.add(createAtmosphere(EARTH_RADIUS_KM));

    let earthMaterial: ShaderMaterial | null = null;
    let saaKm = -1;
    let cancelled = false;
    const mountSaa = (altitudeKm: number) => {
      const nearest = nearestSaaAltitudeKm(altitudeKm);
      if (nearest === saaKm) {
        return;
      }
      saaKm = nearest;
      for (const child of [...saaAnchor.children]) {
        saaAnchor.remove(child);
        const texture = child.userData.texture as { dispose?: () => void } | undefined;
        texture?.dispose?.();
        disposeObject(child);
      }
      const fill = createSaaFill(nearest);
      const rings = createSaaRings(nearest);
      saaAnchor.add(fill, rings);
    };
    mountSaa(altitudeRef.current);

    const loader = new TextureLoader();
    void Promise.all([loader.loadAsync("/earth/blue-marble.jpg"), loader.loadAsync("/earth/night-lights.jpg")])
      .then(([day, night]) => {
        if (cancelled) {
          day.dispose();
          night.dispose();
          return;
        }
        earthMaterial = createEarthMaterial(day, night);
        earthAnchor.add(new Mesh(new SphereGeometry(EARTH_RADIUS_KM, 96, 96), earthMaterial));
      })
      .catch(() => {
        if (!cancelled) {
          onUnavailableRef.current();
        }
      });

    let stats: { begin: () => void; end: () => void; dom: HTMLElement } | null = null;
    if (process.env.NODE_ENV === "development") {
      void import("stats.js").then((module) => {
        if (cancelled) {
          return;
        }
        const panel = new module.default();
        panel.showPanel(0);
        panel.dom.style.position = "absolute";
        panel.dom.style.left = "0";
        panel.dom.style.top = "0";
        host.appendChild(panel.dom);
        stats = panel;
      });
    }

    const samples: number[] = [];
    const started = performance.now();
    let reported = false;
    let last = started;
    let frame = 0;
    const resize = () => {
      const width = host.clientWidth || 640;
      const height = host.clientHeight || 640;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const tick = (now: number) => {
      const frameMs = now - last;
      const dt = Math.min(0.1, frameMs / 1000);
      last = now;
      if (frameMs > 0 && frameMs < 250 && now - started < 10_000) {
        samples.push(1000 / frameMs);
      }
      if (!reported && now - started >= 10_000 && samples.length > 0) {
        reported = true;
        const sorted = [...samples].sort((left, right) => left - right);
        onMedianRef.current(sorted[Math.floor(sorted.length / 2)] ?? 0);
      }
      stats?.begin();
      mountSaa(altitudeRef.current);
      const sample = sampleRef.current;
      const propagated = sample?.starlink;
      if (propagated) {
        const position = starlinkGeometry.getAttribute("position");
        for (let index = 0; index < records.length; index += 1) {
          const lat = propagated[index * 3];
          const lng = propagated[index * 3 + 1];
          const alt = propagated[index * 3 + 2];
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(alt)) {
            position.setXYZ(index, 0, 0, 0);
            continue;
          }
          const [x, y, z] = latLngAltToKm(lat, lng, alt);
          position.setXYZ(index, x, y, z);
        }
        position.needsUpdate = true;
      }
      if (sample?.trail && sample.trail.length > 0) {
        writeOrbitTrail(trail, sample.trail);
      }
      if (sample?.starmind) {
        const [x, y, z] = latLngAltToKm(sample.starmind.latDeg, sample.starmind.lngDeg, sample.starmind.altKm);
        vehicleTarget.set(x, y, z);
        if (vehiclePrevious.lengthSq() === 0) {
          vehiclePrevious.copy(vehicleTarget);
        }
        aimVehicle(vehicle, vehicleTarget, vehiclePrevious);
        const sun = sceneSun(Date.now() - 0, sunScratch);
        sunLight.position.copy(sun);
        const sunUniform = earthMaterial?.uniforms.sunDirection.value as Vector3 | undefined;
        sunUniform?.copy(sun);
      }
      controls.enabled = !followRef.current;
      if (followRef.current && sample?.starmind) {
        followStarmind(camera, vehicleTarget, Math.max(1800, zoomRef.current.km * 0.22), dt);
      } else if (zoomRef.current.dirty) {
        placeCamera(camera, zoomRef.current.km);
        zoomRef.current.dirty = false;
      }
      controls.update();
      renderer.render(scene, camera);
      stats?.end();
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      stats?.dom.remove();
    };
  }, [sampleRef]);

  return <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />;
}

export default function GlobeClient() {
  const sim = useGlobeSim();
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const [follow, setFollow] = useState(false);
  const [zoomKm, setZoomKm] = useState(16_000);
  const [medianFps, setMedianFps] = useState<number | null>(null);
  const fellBack = useRef(false);
  const radius = orbitRadiusKm(sim.altitudeKm);
  const agoMinutes = Math.round(sim.agoS / 60);

  function onMedian(fps: number) {
    setMedianFps(fps);
    if (fps < 45 && !fellBack.current) {
      fellBack.current = true;
      setMode("2d");
    }
  }

  return (
    <div>
      <p
        className="data-sm"
        data-testid="globe-scene-state"
        data-orbit-radius-km={radius.toFixed(3)}
        data-altitude-km={sim.altitudeKm}
        data-mode={mode}
        data-follow={follow ? "true" : "false"}
        data-median-fps={medianFps === null ? "" : medianFps.toFixed(1)}
        data-propagator={sim.propagator}
        data-worker-ms={sim.workerMs === null ? "" : sim.workerMs.toFixed(2)}
      >
        {mode === "3d" ? "3D globe" : "2D ground track"}
        {medianFps === null ? "" : ` · median ${medianFps.toFixed(1)} fps over 10 s`}
      </p>
      <div
        style={{
          position: "relative",
          height: "min(72vh, 820px)",
          minHeight: 420,
          background: "#000000",
          border: "1px solid var(--line)",
        }}
      >
        {mode === "3d" ? (
          <GlobeView
            sampleRef={sim.sampleRef}
            drawnAltitudeKm={sim.drawnAltitudeKm}
            follow={follow}
            zoomKm={zoomKm}
            onMedian={onMedian}
            onUnavailable={() => {
              fellBack.current = true;
              setMode("2d");
            }}
          />
        ) : (
          <GroundTrack2D sampleRef={sim.sampleRef} altitudeKm={sim.drawnAltitudeKm} />
        )}
        <aside
          style={{
            position: "absolute",
            left: 12,
            bottom: 12,
            maxWidth: 280,
            background: "#000000",
            border: "1px solid var(--line)",
            padding: "var(--space-3)",
            pointerEvents: "none",
          }}
        >
          <p className="eyebrow">Legend</p>
          <p className="body-sm">
            Starlink subsampled · {starlinkDemo.records.length} of {starlinkDemo.totalInSnapshot}
          </p>
          <p className="body-sm">Illustrative geometry, not to scale</p>
          <p className="body-sm">SAA |B| &lt; {SAA_THRESHOLD_NT.toLocaleString("en-US")} nT</p>
          <p className="body-sm">Aurora: ground proxy, not dose</p>
        </aside>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-3)",
          marginTop: "var(--space-3)",
          alignItems: "center",
        }}
      >
        <button type="button" className="rok-btn rok-btn--sm" aria-pressed={follow} onClick={() => setFollow((value) => !value)}>
          Follow Starmind
        </button>
        <button
          type="button"
          className="rok-btn rok-btn--sm"
          aria-pressed={mode === "2d"}
          onClick={() => setMode((value) => (value === "3d" ? "2d" : "3d"))}
        >
          {mode === "3d" ? "Ground track" : "3D globe"}
        </button>
        <button type="button" className="rok-btn rok-btn--sm" aria-pressed={sim.playing} onClick={sim.togglePlay}>
          {sim.playing ? "Pause" : "Play"}
        </button>
        <label className="rok-field body-sm">
          Zoom
          <input
            aria-label="Zoom"
            type="range"
            min={9000}
            max={36000}
            step={200}
            value={zoomKm}
            onChange={(event) => setZoomKm(Number(event.target.value))}
          />
        </label>
        <label className="rok-field body-sm">
          Time
          <input
            aria-label="Time"
            type="range"
            min={0}
            max={SCRUB_WINDOW_S}
            step={60}
            value={sim.agoS}
            onChange={(event) => sim.scrub(Number(event.target.value))}
          />
        </label>
        <p className="body-sm rok-muted">
          {agoMinutes === 0 ? "Live" : `${agoMinutes} min ago`} · playback {PLAYBACK_RATE}× is an estimate · scrub window 6 h is an
          estimate
        </p>
      </div>
    </div>
  );
}
