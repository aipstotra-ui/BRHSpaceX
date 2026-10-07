"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { CameraControls } from "@/components/globe/CameraControls";
import { GlobeHud, type HudState } from "@/components/globe/GlobeHud";
import { OrbitTrail, surfaceVector } from "@/components/globe/OrbitTrail";
import { createEarth } from "@/components/globe/scene/earth";
import { createGroundTrack, createOrbitRing, updateGroundTrack, updateOrbitRing } from "@/components/globe/scene/orbit";
import { createStars } from "@/components/globe/scene/stars";
import {
  AURORAL_RGBA,
  auroraPoints,
  overlaySphere,
  ovationLookup,
  saaOutline,
  saaOverlayTexture,
  SEP_RGBA,
  zoneTexture,
  type TrackPoint,
} from "@/components/globe/scene/zones";
import { createStarmindGroup, ILLUSTRATIVE_LABEL } from "@/components/globe/StarmindModel";
import { exposureClass, type StormContext } from "@/lib/engine/globe/exposure";
import { gmstRad, kmToScene, sunAt } from "@/lib/engine/globe/frames";
import { groundTrackAtUtc } from "@/lib/engine/globe/trail";
import { createPropagateWorker } from "@/lib/engine/propagateClient";
import { SHADOW_AU_KM } from "@/lib/engine/orbit/constants";
import { shadowKind } from "@/lib/engine/orbit/eclipse";
import { starmindAtUtc, type StarmindOrbit } from "@/lib/engine/orbit/j2";
import { inAuroralOval, inSepCap, sepActive } from "@/lib/engine/orbit/stormZones";
import { SPEED_LABELS, useClockStore } from "@/lib/store/clock";
import { useOrbitStore } from "@/lib/store/orbit";
import { sampleAt, useTimelineCursor, useTimelineStore } from "@/lib/store/timeline";

type Phase = "loading" | "error" | "empty" | "ready";

const AURORA_CUTOFF = 5;
/** Starlink is only drawn in "now" mode: today's snapshot elements say nothing about where satellites were in a past storm. */
const STARLINK_MODES = new Set(["now"]);
const STARLINK_CAPACITY = 2000;
/** Camera distance from Earth's centre in free mode, Earth radii, per zoom step value. */
const FREE_DISTANCE_PER_ZOOM = 1.2;
/** How quickly the follow camera catches up, per second. */
const FOLLOW_RATE = 4;

export default function GlobeClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const followRef = useRef(false);
  const zoomRef = useRef(2.6);
  const zoomChangedRef = useRef(false);
  const orbitRef = useRef<StarmindOrbit>({
    altitudeKm: 0,
    inclinationDeg: 0,
    sunSynchronous: false,
    ltanHours: null,
    raanDeg: 0,
  });
  const stormRef = useRef<StormContext | undefined>(undefined);
  const hudRef = useRef<HudState | null>(null);
  const starlinkOnRef = useRef(true);
  const starlinkCountRef = useRef(0);
  const starlinkWantMsRef = useRef<number | null>(null);
  const starlinkBusyRef = useRef(false);
  const starlinkRef = useRef<THREE.Points | null>(null);
  const earthGroupRef = useRef<THREE.Group | null>(null);
  const altitudeKm = useOrbitStore((state) => state.altitudeKm);
  const inclinationDeg = useOrbitStore((state) => state.inclinationDeg);
  const sunSynchronous = useOrbitStore((state) => state.sunSynchronous);
  const ltanHours = useOrbitStore((state) => state.ltanHours);
  const raanDeg = useOrbitStore((state) => state.raanDeg);
  const playing = useClockStore((state) => state.playing);
  const speed = useClockStore((state) => state.speed);
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
    const at = new THREE.Vector3();
    worker.onmessage = (event: MessageEvent<{ kind: string; positions?: Float32Array; count?: number; ms?: number; message?: string }>) => {
      if (event.data.kind === "error") {
        setError(event.data.message ?? "Error");
        setPhase("error");
        return;
      }
      if (event.data.kind === "starlink" && event.data.positions) {
        starlinkBusyRef.current = false;
        const nextCount = event.data.count ?? event.data.positions.length / 3;
        const attribute = starlinkRef.current?.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
        if (attribute) {
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

  // Kp oval and proton cap overlay, on the rotating Earth.
  useEffect(() => {
    const earthGroup = earthGroupRef.current;
    if (!earthGroup || !sceneReady || kp === null) {
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
    const overlay = overlaySphere(texture, 1.006);
    earthGroup.add(overlay);
    return () => {
      earthGroup.remove(overlay);
      overlay.geometry.dispose();
      texture.dispose();
      (overlay.material as THREE.Material).dispose();
    };
  }, [kp, protonPfu, useOvation, sceneReady]);

  useEffect(() => {
    const earthGroup = earthGroupRef.current;
    if (!earthGroup || !sceneReady || aurora.length === 0 || !useOvation) {
      return;
    }
    const points = auroraPoints(aurora);
    earthGroup.add(points);
    return () => {
      earthGroup.remove(points);
      points.geometry.dispose();
      (points.material as THREE.Material).dispose();
    };
  }, [aurora, useOvation, sceneReady]);

  useEffect(() => {
    if (!canvasRef.current || !wrapRef.current) {
      return;
    }
    const canvas = canvasRef.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
    } catch {
      window.setTimeout(() => setError("This browser cannot draw the 3D Earth. WebGL is unavailable."), 0);
      return;
    }
    if (!renderer.getContext()) {
      renderer.dispose();
      window.setTimeout(() => setError("This browser cannot draw the 3D Earth. WebGL is unavailable."), 0);
      return;
    }
    renderer.setClearColor(0x000000, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    // Scene axes are inertial (see lib/engine/globe/frames.ts); the Earth group turns by GMST.
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 200);
    camera.position.set(0.25, 0.9, 2.95);
    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.25;
    controls.maxDistance = 8;

    const stars = createStars();
    scene.add(stars);
    const earth = createEarth();
    scene.add(earth.root);
    const earthGroup = earth.group;
    earthGroupRef.current = earthGroup;

    // Lights only affect the craft; the Earth shader does its own sunlight.
    const sunLight = new THREE.DirectionalLight("#ffffff", 2.4);
    scene.add(sunLight);
    scene.add(new THREE.AmbientLight("#9fb4d0", 0.08));

    const saaOverlay = overlaySphere(saaOverlayTexture(), 1.004);
    earthGroup.add(saaOverlay);
    const saaLine = saaOutline();
    earthGroup.add(saaLine);

    const starlinkGeometry = new THREE.BufferGeometry();
    starlinkGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(STARLINK_CAPACITY * 3), 3));
    starlinkGeometry.setDrawRange(0, 0);
    const starlink = new THREE.Points(
      starlinkGeometry,
      new THREE.PointsMaterial({ color: "#6fd3ff", size: 2.2, sizeAttenuation: false, toneMapped: false, transparent: true, opacity: 0.8 }),
    );
    starlink.name = "starlink";
    starlinkRef.current = starlink;
    earthGroup.add(starlink);

    const groundTrack = createGroundTrack();
    earthGroup.add(groundTrack);
    const ring = createOrbitRing();
    scene.add(ring);
    const craft = createStarmindGroup();
    scene.add(craft);

    window.setTimeout(() => setSceneReady(true), 0);

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

    const resize = () => {
      const width = Math.max(260, Math.floor(wrapRef.current?.clientWidth ?? 640));
      const height = Math.round(Math.min(760, Math.max(300, width * 0.82)));
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      canvas.style.width = "100%";
      canvas.style.height = `${height}px`;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrapRef.current);

    // Scratch vectors reused every frame. The orbit maths still returns a few small objects per frame.
    const craftAt = new THREE.Vector3();
    const sunScene = new THREE.Vector3();
    const followGoal = new THREE.Vector3();
    const lookGoal = new THREE.Vector3();
    const look = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const sunKm = { x: 0, y: 0, z: 0 };
    let last = performance.now();
    let frame = 0;

    const animate = (now: number) => {
      stats?.begin();
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      const timeline = useTimelineStore.getState();
      const simTimeMs = timeline.simTimeMs;

      earthGroup.rotation.y = gmstRad(simTimeMs);
      const sun = sunAt(simTimeMs);
      kmToScene(sun.unit, sunScene);
      earth.setSunDirection(sunScene);
      sunLight.position.copy(sunScene).multiplyScalar(10);

      // Starlink: ask the worker for the current simulation time whenever it is free and the time has moved.
      starlink.visible = starlinkOnRef.current;
      starlink.geometry.setDrawRange(0, starlinkOnRef.current ? starlinkCountRef.current : 0);
      if (starlinkOnRef.current && !starlinkBusyRef.current && starlinkWantMsRef.current !== simTimeMs) {
        starlinkBusyRef.current = true;
        starlinkWantMsRef.current = simTimeMs;
        workerRef.current?.postMessage({ kind: "scrub", epochMs: simTimeMs });
      }

      const orbit = orbitRef.current;
      const fix = starmindAtUtc(orbit, simTimeMs);
      kmToScene({ x: fix.xKm, y: fix.yKm, z: fix.zKm }, craftAt);
      craft.position.copy(craftAt);
      craft.userData.radiusKm = fix.radiusKm;
      updateOrbitRing(ring, orbit, simTimeMs);
      updateGroundTrack(groundTrack, groundTrackAtUtc(orbit, simTimeMs, stormRef.current));

      sunKm.x = sun.unit.x * SHADOW_AU_KM;
      sunKm.y = sun.unit.y * SHADOW_AU_KM;
      sunKm.z = sun.unit.z * SHADOW_AU_KM;
      const sample = sampleAt(timeline.points, simTimeMs);
      hudRef.current = {
        utcMs: simTimeMs,
        latDeg: fix.latDeg,
        lonDeg: fix.lonDeg,
        altKm: fix.altKm,
        exposure: exposureClass(fix.latDeg, fix.lonDeg, fix.altKm, stormRef.current),
        shadow: shadowKind({ x: fix.xKm, y: fix.yKm, z: fix.zKm }, sunKm),
        kp: sample.kp,
        protonPfu: sample.protonPfu,
      };

      if (followRef.current) {
        // Chase view: above the craft, eased so playback does not jerk the camera.
        controls.enabled = false;
        followGoal.copy(craftAt).multiplyScalar(zoomRef.current * 0.55 + 0.45).addScaledVector(up, 0.25);
        lookGoal.copy(craftAt);
        const ease = 1 - Math.exp(-FOLLOW_RATE * dt);
        camera.position.lerp(followGoal, ease);
        look.lerp(lookGoal, ease);
        camera.lookAt(look);
      } else {
        controls.enabled = true;
        if (zoomChangedRef.current) {
          camera.position.setLength(zoomRef.current * FREE_DISTANCE_PER_ZOOM);
          zoomChangedRef.current = false;
        }
        look.set(0, 0, 0);
        controls.update();
      }
      renderer.render(scene, camera);
      stats?.end();
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      const disposeObject = (object: THREE.Object3D) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        const materials = Array.isArray(material) ? material : material ? [material] : [];
        for (const item of materials) {
          (item as THREE.MeshBasicMaterial).map?.dispose();
          item.dispose();
        }
      };
      for (const object of [stars, saaOverlay, saaLine, starlink, groundTrack, ring]) {
        disposeObject(object);
      }
      craft.traverse(disposeObject);
      earth.dispose();
      renderer.dispose();
      stats?.dom.remove();
      earthGroupRef.current = null;
      starlinkRef.current = null;
      setSceneReady(false);
    };
  }, []);

  return (
    <div ref={wrapRef} className="globe">
      <div className="globe__stage">
        <canvas ref={canvasRef} aria-label="Round Earth" />
        <GlobeHud stateRef={hudRef} playing={playing} speedLabel={SPEED_LABELS[speed]} />
        <p className="globe__overlay eyebrow">{ILLUSTRATIVE_LABEL}</p>
        {phase === "loading" ? <p className="globe__status rok-muted">Loading</p> : null}
        {phase === "error" ? <p className="globe__status error">{error ?? "Error"}</p> : null}
        {phase === "empty" ? <p className="globe__status rok-muted">Empty</p> : null}
      </div>
      <OrbitTrail />
      <CameraControls
        follow={follow}
        onFollow={setFollow}
        onZoom={(direction) => {
          zoomRef.current = Math.min(6, Math.max(1.3, zoomRef.current + direction * -0.3));
          zoomChangedRef.current = true;
        }}
      />
      <p className="note">
        Day side, night side and terminator follow the Sun at the timeline time; the Earth turns by sidereal time.
        Starlink points are subsampled ({count} shown)
        {starlinkOn ? "" : " and hidden during historical replays, since today's elements cannot place them then"}.
        OVATION cutoff {AURORA_CUTOFF} is an estimate. The SAA polygon is the Fermi GBM ring. Auroral zone and outer belt
        are NASA SP-8116. Aurora points (violet) are OVATION. Stars are decorative.
        {tickMs !== null ? ` Worker tick ${tickMs.toFixed(1)} ms.` : ""}
      </p>
    </div>
  );
}
