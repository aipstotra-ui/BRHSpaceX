"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { CameraControls } from "@/components/globe/CameraControls";
import { createTrailLine, OrbitTrail, surfaceVector } from "@/components/globe/OrbitTrail";
import { createStarmindGroup, ILLUSTRATIVE_LABEL } from "@/components/globe/StarmindModel";
import { classFromCode } from "@/lib/engine/globe/exposure";
import { lerpScene } from "@/lib/engine/globe/interpolate";
import { ORBIT_DEBOUNCE_MS, STARLINK_TICK_MS } from "@/lib/engine/globe/timing";
import { createPropagateWorker } from "@/lib/engine/propagateClient";
import { starmindPositionKm } from "@/lib/engine/orbit/j2";
import type { StarmindSample } from "@/lib/engine/globe/trail";
import { GBM_SAA_LAT, GBM_SAA_LON, inSaa } from "@/lib/engine/radiation";
import { useOrbitStore } from "@/lib/store/orbit";

type Phase = "loading" | "error" | "empty" | "ready";

const AURORA_CUTOFF = 5;

type TrackPoint = { latDeg: number; lonDeg: number };

function saaOverlayTexture(): THREE.CanvasTexture {
  const width = 512;
  const height = 256;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }
  const image = context.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    const lat = 90 - (y / (height - 1)) * 180;
    for (let x = 0; x < width; x += 1) {
      const lon = (x / (width - 1)) * 360 - 180;
      if (!inSaa(lat, lon)) {
        continue;
      }
      const offset = (y * width + x) * 4;
      image.data[offset] = 214;
      image.data[offset + 1] = 48;
      image.data[offset + 2] = 112;
      image.data[offset + 3] = 120;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function auroraPoints(points: TrackPoint[]): THREE.Points {
  const positions = new Float32Array(points.length * 3);
  points.forEach((point, index) => {
    const at = surfaceVector(point.latDeg, point.lonDeg, 80);
    positions[index * 3] = at.x;
    positions[index * 3 + 1] = at.y;
    positions[index * 3 + 2] = at.z;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color: "#7d5cff", size: 0.012 }));
}

export default function GlobeClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const followRef = useRef(false);
  const zoomRef = useRef(2.6);
  const orbitRef = useRef({ altitudeKm: 0, inclinationDeg: 0, raanDeg: 0, scrubS: 0 });
  const starlinkFromRef = useRef<Float32Array | null>(null);
  const starlinkToRef = useRef<Float32Array | null>(null);
  const starlinkAtRef = useRef(0);
  const starlinkCountRef = useRef(0);
  const auroraRef = useRef<TrackPoint[]>([]);
  const pointsRef = useRef<THREE.Points | null>(null);
  const trailRef = useRef<THREE.LineSegments | null>(null);
  const craftRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const altitudeKm = useOrbitStore((state) => state.altitudeKm);
  const inclinationDeg = useOrbitStore((state) => state.inclinationDeg);
  const raanDeg = useOrbitStore((state) => state.raanDeg);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [follow, setFollow] = useState(false);
  const [scrubS, setScrubS] = useState(0);
  const [trail, setTrail] = useState<StarmindSample[]>([]);
  const [aurora, setAurora] = useState<TrackPoint[]>([]);
  const [count, setCount] = useState(0);
  const [tickMs, setTickMs] = useState<number | null>(null);

  useEffect(() => {
    orbitRef.current = { altitudeKm, inclinationDeg, raanDeg, scrubS };
    followRef.current = follow;
    auroraRef.current = aurora;
  }, [altitudeKm, inclinationDeg, raanDeg, scrubS, follow, aurora]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/data/aurora")
      .then((response) => response.json())
      .then((body: { data?: { coordinates?: [number, number, number][] } }) => {
        if (cancelled) {
          return;
        }
        const coordinates = body.data?.coordinates ?? [];
        setAurora(
          coordinates
            .filter((row) => row[2] >= AURORA_CUTOFF)
            .map((row) => ({ lonDeg: row[0], latDeg: row[1] })),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setAurora([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const worker = createPropagateWorker();
    worker.onmessage = (event: MessageEvent<{ kind: string; positions?: Float32Array; count?: number; ms?: number; trail?: StarmindSample[]; message?: string }>) => {
      if (event.data.kind === "error") {
        setError(event.data.message ?? "Error");
        setPhase("error");
        return;
      }
      if (event.data.kind === "starlink" && event.data.positions) {
        const nextCount = event.data.count ?? event.data.positions.length / 3;
        const scenePositions = new Float32Array(nextCount * 3);
        for (let index = 0; index < nextCount; index += 1) {
          const at = surfaceVector(
            event.data.positions[index * 3],
            event.data.positions[index * 3 + 1],
            event.data.positions[index * 3 + 2],
          );
          scenePositions[index * 3] = at.x;
          scenePositions[index * 3 + 1] = at.y;
          scenePositions[index * 3 + 2] = at.z;
        }
        starlinkFromRef.current = starlinkToRef.current ?? scenePositions;
        starlinkToRef.current = scenePositions;
        starlinkAtRef.current = performance.now();
        starlinkCountRef.current = nextCount;
        setCount(nextCount);
        setTickMs(event.data.ms ?? null);
        setPhase(nextCount === 0 ? "empty" : "ready");
      }
      if (event.data.kind === "starmind" && event.data.trail) {
        setTrail(event.data.trail);
        if (sceneRef.current && trailRef.current) {
          sceneRef.current.remove(trailRef.current);
          trailRef.current.geometry.dispose();
          trailRef.current = createTrailLine(event.data.trail);
          sceneRef.current.add(trailRef.current);
        }
      }
    };
    workerRef.current = worker;
    worker.postMessage({ kind: "init", epochMs: Date.now() });
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      workerRef.current?.postMessage({ kind: "scrub", epochMs: Date.now() + scrubS * 1000 });
      workerRef.current?.postMessage({
        kind: "starmind",
        altitudeKm,
        inclinationDeg,
        raanDeg,
        epochMs: scrubS * 1000,
      });
    }, ORBIT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [altitudeKm, inclinationDeg, raanDeg, scrubS]);

  useEffect(() => {
    if (!canvasRef.current || !wrapRef.current) {
      return;
    }
    const canvas = canvasRef.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
      renderer.setClearColor(0x000000, 1);
    } catch {
      window.setTimeout(() => setError("This browser cannot draw the 3D Earth. WebGL is unavailable."), 0);
      return;
    }
    if (!renderer.getContext()) {
      renderer.dispose();
      window.setTimeout(() => setError("This browser cannot draw the 3D Earth. WebGL is unavailable."), 0);
      return;
    }
    renderer.setPixelRatio(1);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#000000");
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 20);
    camera.position.set(0.2, 0.45, 3.15);
    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    scene.add(new THREE.AmbientLight("#ffffff", 0.7));
    const sun = new THREE.DirectionalLight("#ffffff", 1.2);
    sun.position.set(3, 2, 1);
    scene.add(sun);
    const earthMaterial = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1 });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), earthMaterial);
    scene.add(earth);
    // NASA Blue Marble image shipped with three-globe's examples. Public-domain Earth photograph.
    new THREE.TextureLoader().load("/globe/earth-day.jpg", (earthTexture) => {
      earthTexture.colorSpace = THREE.SRGBColorSpace;
      earthTexture.anisotropy = 8;
      earthMaterial.map = earthTexture;
      earthMaterial.needsUpdate = true;
    });
    scene.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(1.004, 64, 48),
        new THREE.MeshBasicMaterial({
          map: saaOverlayTexture(),
          transparent: true,
          depthWrite: false,
        }),
      ),
    );
    const saaPoints: number[] = [];
    for (let index = 0; index < GBM_SAA_LAT.length; index += 1) {
      const at = surfaceVector(GBM_SAA_LAT[index], GBM_SAA_LON[index], 40);
      saaPoints.push(at.x, at.y, at.z);
    }
    const saaGeometry = new THREE.BufferGeometry();
    saaGeometry.setAttribute("position", new THREE.Float32BufferAttribute(saaPoints, 3));
    scene.add(new THREE.Line(saaGeometry, new THREE.LineBasicMaterial({ color: "#e23b3b" })));
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(2000 * 3), 3));
    starGeometry.setDrawRange(0, 0);
    const points = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({ color: "#f5f7fb", size: 0.012, sizeAttenuation: true }),
    );
    pointsRef.current = points;
    scene.add(points);
    const craft = createStarmindGroup();
    craftRef.current = craft;
    scene.add(craft);
    if (auroraRef.current.length > 0) {
      scene.add(auroraPoints(auroraRef.current));
    }
    let stats: { begin: () => void; end: () => void; dom: HTMLElement } | null = null;
    if (process.env.NODE_ENV === "development") {
      void import("stats.js").then((mod) => {
        const panel = new mod.default();
        panel.showPanel(0);
        panel.dom.style.position = "absolute";
        wrapRef.current?.appendChild(panel.dom);
        stats = panel;
      });
    }
    let frame = 0;
    const resize = () => {
      // Square canvas that fits its column, capped at the old fixed 640 px.
      const size = Math.max(240, Math.min(640, Math.floor(wrapRef.current?.clientWidth ?? 640)));
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(size, size, true);
      canvas.style.maxWidth = "100%";
      canvas.style.display = "block";
      canvas.style.margin = "0 auto";
      canvas.style.background = "var(--surface-100)";
      camera.aspect = 1;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (wrapRef.current) {
      observer.observe(wrapRef.current);
    }
    const animate = (now: number) => {
      stats?.begin();
      const attribute = points.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
      const from = starlinkFromRef.current;
      const to = starlinkToRef.current;
      if (attribute && from && to) {
        const elapsed = (now - starlinkAtRef.current) / STARLINK_TICK_MS;
        const drawn = lerpScene(from, to, elapsed, attribute.array as Float32Array);
        attribute.needsUpdate = true;
        points.geometry.setDrawRange(0, Math.min(drawn, starlinkCountRef.current));
      }
      const orbit = orbitRef.current;
      const fix = starmindPositionKm(orbit.altitudeKm, orbit.inclinationDeg, orbit.raanDeg, orbit.scrubS);
      const at = surfaceVector(fix.latDeg, fix.lonDeg, fix.altKm);
      craft.position.copy(at);
      craft.userData.radiusKm = fix.radiusKm;
      const distance = zoomRef.current;
      if (followRef.current) {
        controls.enabled = false;
        camera.position.set(at.x * distance, at.y * distance + 0.4, at.z * distance);
        camera.lookAt(at);
      } else {
        controls.enabled = true;
        controls.update();
      }
      renderer.render(scene, camera);
      stats?.end();
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    window.addEventListener("resize", resize);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      controls.dispose();
      renderer.dispose();
      stats?.dom.remove();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || aurora.length === 0) {
      return;
    }
    const points = auroraPoints(aurora);
    scene.add(points);
    return () => {
      scene.remove(points);
      points.geometry.dispose();
    };
  }, [aurora]);

  return (
    <div ref={wrapRef} className="globe">
      <div className="globe__stage">
        <canvas ref={canvasRef} aria-label="Round Earth" />
        <p className="globe__overlay eyebrow">{ILLUSTRATIVE_LABEL}</p>
        {phase === "loading" ? <p className="globe__status rok-muted">Loading</p> : null}
        {phase === "error" ? (
          <p className="globe__status" style={{ color: "var(--status-critical)" }}>
            {error ?? "Error"}
          </p>
        ) : null}
        {phase === "empty" ? <p className="globe__status rok-muted">Empty</p> : null}
      </div>
      <OrbitTrail samples={trail} />
      <CameraControls
        follow={follow}
        onFollow={setFollow}
        onZoom={(direction) => {
          zoomRef.current = Math.min(6, Math.max(1.3, zoomRef.current + direction * -0.3));
        }}
      />
      <label className="rok-field globe__scrub">
        <span className="rok-field__label eyebrow">
          Time offset{" "}
          <span className="data-sm rok-muted">
            {scrubS >= 0 ? "+" : "−"}
            {(Math.abs(scrubS) / 3600).toFixed(1)} h
          </span>
        </span>
        <input
          aria-label="Time scrubber"
          type="range"
          min={-43200}
          max={43200}
          step={60}
          value={scrubS}
          onChange={(event) => setScrubS(Number(event.target.value))}
        />
      </label>
      <p className="note">
        Starlink points are subsampled ({count} shown). OVATION cutoff {AURORA_CUTOFF} is an estimate. Trail length
        is one orbit, an estimate. SAA polygon ({classFromCode(1)}) is the Fermi GBM ring. Auroral zone and outer belt
        are NASA SP-8116. Aurora points (violet) are OVATION.
        {tickMs !== null ? ` Worker tick ${tickMs.toFixed(1)} ms.` : ""}
      </p>
    </div>
  );
}
