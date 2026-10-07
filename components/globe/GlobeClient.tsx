"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { CameraControls } from "@/components/globe/CameraControls";
import { createTrailLine, OrbitTrail, surfaceVector, updateTrailLine } from "@/components/globe/OrbitTrail";
import { createStarmindGroup, ILLUSTRATIVE_LABEL } from "@/components/globe/StarmindModel";
import { classFromCode, type StormContext } from "@/lib/engine/globe/exposure";
import { starmindTrailAtUtc } from "@/lib/engine/globe/trail";
import { createPropagateWorker } from "@/lib/engine/propagateClient";
import { starmindAtUtc, type StarmindOrbit } from "@/lib/engine/orbit/j2";
import { GBM_SAA_LAT, GBM_SAA_LON, inSaa } from "@/lib/engine/radiation";
import { inAuroralOval, inSepCap, sepActive } from "@/lib/engine/orbit/stormZones";
import { useOrbitStore } from "@/lib/store/orbit";
import { useTimelineCursor, useTimelineStore } from "@/lib/store/timeline";

type Phase = "loading" | "error" | "empty" | "ready";

const AURORA_CUTOFF = 5;
/** Starlink is only drawn in "now" mode: today's snapshot elements say nothing about where satellites were in a past storm. */
const STARLINK_MODES = new Set(["now"]);

type TrackPoint = { latDeg: number; lonDeg: number };

type Rgba = [number, number, number, number];

/** Equirectangular overlay: each pixel takes the color the test returns, or stays clear. */
function zoneTexture(test: (latDeg: number, lonDeg: number) => Rgba | null): THREE.CanvasTexture {
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
      const color = test(lat, lon);
      if (!color) {
        continue;
      }
      const offset = (y * width + x) * 4;
      image.data.set(color, offset);
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const AURORAL_RGBA: Rgba = [61, 220, 151, 90];
const SEP_RGBA: Rgba = [255, 95, 210, 110];

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

function ovationLookup(points: TrackPoint[]): (latDeg: number, lonDeg: number) => boolean {
  const cells = new Set(points.map((point) => `${Math.round(point.latDeg)}|${(Math.round(point.lonDeg) + 360) % 360}`));
  return (latDeg, lonDeg) => cells.has(`${Math.round(latDeg)}|${(Math.round(lonDeg) + 360) % 360}`);
}

export default function GlobeClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const followRef = useRef(false);
  const zoomRef = useRef(2.6);
  const orbitRef = useRef<StarmindOrbit>({
    altitudeKm: 0,
    inclinationDeg: 0,
    sunSynchronous: false,
    ltanHours: null,
    raanDeg: 0,
  });
  const stormRef = useRef<StormContext | undefined>(undefined);
  const starlinkOnRef = useRef(true);
  const starlinkCountRef = useRef(0);
  const starlinkWantMsRef = useRef<number | null>(null);
  const starlinkBusyRef = useRef(false);
  const pointsRef = useRef<THREE.Points | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const altitudeKm = useOrbitStore((state) => state.altitudeKm);
  const inclinationDeg = useOrbitStore((state) => state.inclinationDeg);
  const sunSynchronous = useOrbitStore((state) => state.sunSynchronous);
  const ltanHours = useOrbitStore((state) => state.ltanHours);
  const raanDeg = useOrbitStore((state) => state.raanDeg);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [follow, setFollow] = useState(false);
  const cursor = useTimelineCursor();
  const kp = cursor.point?.kp ?? null;
  const protonPfu = cursor.point?.protonPfu ?? null;
  const starlinkOn = STARLINK_MODES.has(cursor.mode);
  // OVATION is a nowcast, so it only replaces the Kp oval model at the latest observed point.
  const useOvation =
    cursor.mode === "now" && cursor.point?.kind === "observed" && Math.abs(cursor.offsetS) < 3 * 3600;
  const [sceneReady, setSceneReady] = useState(false);
  const [aurora, setAurora] = useState<TrackPoint[]>([]);
  const [count, setCount] = useState(0);
  const [tickMs, setTickMs] = useState<number | null>(null);

  useEffect(() => {
    orbitRef.current = { altitudeKm, inclinationDeg, sunSynchronous, ltanHours, raanDeg };
    followRef.current = follow;
    starlinkOnRef.current = starlinkOn;
  }, [altitudeKm, inclinationDeg, sunSynchronous, ltanHours, raanDeg, follow, starlinkOn]);

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
    worker.onmessage = (event: MessageEvent<{ kind: string; positions?: Float32Array; count?: number; ms?: number; message?: string }>) => {
      if (event.data.kind === "error") {
        setError(event.data.message ?? "Error");
        setPhase("error");
        return;
      }
      if (event.data.kind === "starlink" && event.data.positions) {
        starlinkBusyRef.current = false;
        const nextCount = event.data.count ?? event.data.positions.length / 3;
        const attribute = pointsRef.current?.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
        if (attribute) {
          const at = new THREE.Vector3();
          const drawn = Math.min(nextCount, attribute.count);
          for (let index = 0; index < drawn; index += 1) {
            surfaceVector(
              event.data.positions[index * 3],
              event.data.positions[index * 3 + 1],
              event.data.positions[index * 3 + 2],
              at,
            );
            attribute.setXYZ(index, at.x, at.y, at.z);
          }
          attribute.needsUpdate = true;
          starlinkCountRef.current = drawn;
        }
        setCount(nextCount);
        setTickMs(event.data.ms ?? null);
        setPhase(nextCount === 0 ? "empty" : "ready");
      }
    };
    workerRef.current = worker;
    starlinkBusyRef.current = true;
    worker.postMessage({ kind: "init", epochMs: useTimelineStore.getState().simTimeMs || Date.now() });
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const storm: StormContext | undefined = useMemo(() => {
    if (kp === null) {
      return undefined;
    }
    return { kp, protonPfu, inOvation: useOvation && aurora.length > 0 ? ovationLookup(aurora) : undefined };
  }, [kp, protonPfu, useOvation, aurora]);

  useEffect(() => {
    stormRef.current = storm;
  }, [storm]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !sceneReady || kp === null) {
      return;
    }
    const protonsOn = protonPfu !== null && sepActive(protonPfu);
    if (useOvation && !protonsOn) {
      return;
    }
    // Live OVATION points already show the oval "now", so the Kp model only draws it for other times.
    const texture = zoneTexture((lat, lon) => {
      if (protonsOn && inSepCap(lat, lon, kp, protonPfu)) {
        return SEP_RGBA;
      }
      if (!useOvation && inAuroralOval(lat, lon, kp)) {
        return AURORAL_RGBA;
      }
      return null;
    });
    const overlay = new THREE.Mesh(
      new THREE.SphereGeometry(1.006, 64, 48),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
    );
    scene.add(overlay);
    return () => {
      scene.remove(overlay);
      overlay.geometry.dispose();
      texture.dispose();
      (overlay.material as THREE.Material).dispose();
    };
  }, [kp, protonPfu, useOvation, sceneReady]);

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
    window.setTimeout(() => setSceneReady(true), 0);
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
    scene.add(craft);
    const trailLine = createTrailLine();
    scene.add(trailLine);
    const craftAt = new THREE.Vector3();
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
    const animate = () => {
      stats?.begin();
      const simTimeMs = useTimelineStore.getState().simTimeMs;
      // Starlink: ask the worker for the current simulation time whenever it is free and the time has moved.
      points.visible = starlinkOnRef.current;
      points.geometry.setDrawRange(0, starlinkOnRef.current ? starlinkCountRef.current : 0);
      if (starlinkOnRef.current && !starlinkBusyRef.current && starlinkWantMsRef.current !== simTimeMs) {
        starlinkBusyRef.current = true;
        starlinkWantMsRef.current = simTimeMs;
        workerRef.current?.postMessage({ kind: "scrub", epochMs: simTimeMs });
      }
      const orbit = orbitRef.current;
      const fix = starmindAtUtc(orbit, simTimeMs);
      const at = surfaceVector(fix.latDeg, fix.lonDeg, fix.altKm, craftAt);
      craft.position.copy(at);
      craft.userData.radiusKm = fix.radiusKm;
      updateTrailLine(trailLine, starmindTrailAtUtc(orbit, simTimeMs, stormRef.current));
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
      trailLine.geometry.dispose();
      (trailLine.material as THREE.Material).dispose();
      renderer.dispose();
      stats?.dom.remove();
      sceneRef.current = null;
      setSceneReady(false);
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !sceneReady || aurora.length === 0 || !useOvation) {
      return;
    }
    const points = auroraPoints(aurora);
    scene.add(points);
    return () => {
      scene.remove(points);
      points.geometry.dispose();
    };
  }, [aurora, useOvation, sceneReady]);

  return (
    <div ref={wrapRef} className="globe">
      <div className="globe__stage">
        <canvas ref={canvasRef} aria-label="Round Earth" />
        <p className="globe__overlay eyebrow">{ILLUSTRATIVE_LABEL}</p>
        {phase === "loading" ? <p className="globe__status rok-muted">Loading</p> : null}
        {phase === "error" ? (
          <p className="globe__status error">
            {error ?? "Error"}
          </p>
        ) : null}
        {phase === "empty" ? <p className="globe__status rok-muted">Empty</p> : null}
      </div>
      <OrbitTrail />
      <CameraControls
        follow={follow}
        onFollow={setFollow}
        onZoom={(direction) => {
          zoomRef.current = Math.min(6, Math.max(1.3, zoomRef.current + direction * -0.3));
        }}
      />
      <p className="note">
        Starlink points are subsampled ({count} shown). OVATION cutoff {AURORA_CUTOFF} is an estimate. Trail length
        is one orbit, an estimate.{starlinkOn ? "" : " Starlink is hidden during historical replays."} SAA polygon ({classFromCode(1)}) is the Fermi GBM ring. Auroral zone and outer belt
        are NASA SP-8116. Aurora points (violet) are OVATION.
        {tickMs !== null ? ` Worker tick ${tickMs.toFixed(1)} ms.` : ""}
      </p>
    </div>
  );
}
