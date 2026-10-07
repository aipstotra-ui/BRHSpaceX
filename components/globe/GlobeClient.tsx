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
  createAuroraLayer,
  createSaaLayer,
  createSepLayer,
  ovationLookup,
  type AuroraLayer,
  type SaaLayer,
  type SepLayer,
  type TrackPoint,
} from "@/components/globe/scene/zones";
import { LayerToggles, DEFAULT_LAYERS, type Layers } from "@/components/globe/LayerToggles";
import { createCraft, scaleLabel, type CraftScale } from "@/components/globe/StarmindModel";
import { exposureClass, type SaaTest, type StormContext } from "@/lib/engine/globe/exposure";
import { gmstRad, kmToScene, sunAt } from "@/lib/engine/globe/frames";
import { decodeProtonMap, inSaaFlux, type ProtonMap, type ProtonMapFile } from "@/lib/engine/globe/protonMap";
import { groundTrackAtUtc } from "@/lib/engine/globe/trail";
import { createPropagateWorker } from "@/lib/engine/propagateClient";
import { SHADOW_AU_KM } from "@/lib/engine/orbit/constants";
import { shadowKind } from "@/lib/engine/orbit/eclipse";
import { starmindAtUtc, type StarmindOrbit } from "@/lib/engine/orbit/j2";
import { auroralBoundaryMlatDeg, auroralPolewardMlatDeg, sepCutoffMlatDeg } from "@/lib/engine/orbit/stormZones";
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
/** How quickly the follow camera settles on its offset, per second. */
const FOLLOW_RATE = 4;
/** Follow camera offset in the craft's frame, in wingspans: behind (-X), above (+Y), to the side (+Z). */
const FOLLOW_OFFSET = { back: 1.7, up: 0.6, side: 0.9 };
/** Near plane of the world pass. The craft has its own pass, so this can stay comfortable for the Earth. */
const WORLD_NEAR = 1e-4;

export default function GlobeClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const followRef = useRef(false);
  const zoomRef = useRef(2.6);
  const zoomChangedRef = useRef(false);
  const craftScaleRef = useRef<CraftScale>("enlarged");
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
  const groundTrackRef = useRef<THREE.Line | null>(null);
  const earthGroupRef = useRef<THREE.Group | null>(null);
  const auroraLayerRef = useRef<AuroraLayer | null>(null);
  const sepLayerRef = useRef<SepLayer | null>(null);
  const saaLayerRef = useRef<SaaLayer | null>(null);
  const saaTestRef = useRef<SaaTest | undefined>(undefined);
  /** The Kp band needs a Kp; OVATION needs the latest observed block. Otherwise there is no oval to draw. */
  const auroraAvailableRef = useRef(false);
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
  const [craftScale, setCraftScale] = useState<CraftScale>("enlarged");
  const cursor = useTimelineCursor();
  const kp = cursor.point?.kp ?? null;
  const protonPfu = cursor.point?.protonPfu ?? null;
  const starlinkOn = STARLINK_MODES.has(cursor.mode);
  // OVATION is a nowcast, so it only replaces the Kp oval model at the latest observed point.
  const useOvation =
    cursor.mode === "now" && cursor.point?.kind === "observed" && Math.abs(cursor.offsetS) < 3 * 3600;
  const [sceneReady, setSceneReady] = useState(false);
  const [ovationRaw, setOvationRaw] = useState<[number, number, number][]>([]);
  const [protonMap, setProtonMap] = useState<ProtonMap | null>(null);
  const [layers, setLayers] = useState<Layers>(DEFAULT_LAYERS);
  const layersRef = useRef<Layers>(DEFAULT_LAYERS);
  const aurora: TrackPoint[] = useMemo(
    () => ovationRaw.filter((row) => row[2] >= AURORA_CUTOFF).map((row) => ({ lonDeg: row[0], latDeg: row[1] })),
    [ovationRaw],
  );
  const [count, setCount] = useState(0);
  const [tickMs, setTickMs] = useState<number | null>(null);

  useEffect(() => {
    orbitRef.current = { altitudeKm, inclinationDeg, sunSynchronous, ltanHours, raanDeg };
    followRef.current = follow;
    craftScaleRef.current = craftScale;
    starlinkOnRef.current = starlinkOn && layers.starlink;
    layersRef.current = layers;
    auroraAvailableRef.current = kp !== null || useOvation;
  }, [altitudeKm, inclinationDeg, sunSynchronous, ltanHours, raanDeg, follow, craftScale, starlinkOn, layers, kp, useOvation]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/data/aurora")
      .then((response) => response.json())
      .then((body: { data?: { coordinates?: [number, number, number][] } }) => {
        if (cancelled) {
          return;
        }
        setOvationRaw(body.data?.coordinates ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setOvationRaw([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // AP8 trapped-proton map for the SAA (scripts/orbit/saa_map.py). Until it loads, the GBM polygon classifies.
  useEffect(() => {
    let cancelled = false;
    void fetch("/globe/proton-flux-map.json")
      .then((response) => response.json() as Promise<ProtonMapFile>)
      .then((file) => {
        if (!cancelled) {
          setProtonMap(decodeProtonMap(file));
        }
      })
      .catch(() => undefined);
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

  // The zone layers follow the timeline block: Kp moves the oval and the proton cutoff; protons switch the cap.
  useEffect(() => {
    if (!sceneReady) {
      return;
    }
    if (kp !== null) {
      auroraLayerRef.current?.setBand(auroralBoundaryMlatDeg(kp), auroralPolewardMlatDeg(kp), kp);
    }
    sepLayerRef.current?.setEvent(sepCutoffMlatDeg(kp ?? 0), kp === null ? null : protonPfu);
    // OVATION is a nowcast, so it replaces the Kp band only at the latest observed block.
    auroraLayerRef.current?.setOvation(useOvation && ovationRaw.length > 0 ? ovationRaw : null);
  }, [kp, protonPfu, useOvation, ovationRaw, sceneReady]);

  useEffect(() => {
    const earthGroup = earthGroupRef.current;
    if (!earthGroup || !sceneReady || !protonMap) {
      return;
    }
    const layer = createSaaLayer(protonMap);
    layer.setAltitude(orbitRef.current.altitudeKm);
    earthGroup.add(layer.mesh);
    saaLayerRef.current = layer;
    saaTestRef.current = (latDeg, lonDeg, altKm) => inSaaFlux(protonMap, latDeg, lonDeg, altKm);
    return () => {
      earthGroup.remove(layer.mesh);
      layer.dispose();
      saaLayerRef.current = null;
      saaTestRef.current = undefined;
    };
  }, [protonMap, sceneReady]);

  useEffect(() => {
    saaLayerRef.current?.setAltitude(altitudeKm);
  }, [altitudeKm, protonMap]);

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

    const auroraLayer = createAuroraLayer();
    earthGroup.add(auroraLayer.mesh);
    auroraLayerRef.current = auroraLayer;
    const sepLayer = createSepLayer();
    earthGroup.add(sepLayer.mesh);
    sepLayerRef.current = sepLayer;

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
    groundTrack.renderOrder = 5;
    earthGroup.add(groundTrack);
    groundTrackRef.current = groundTrack;
    const ring = createOrbitRing();
    scene.add(ring);
    // The craft has its own scene and lights; it is drawn after the world (see the render passes below).
    const craft = createCraft();
    renderer.autoClear = false;

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
    const nextAt = new THREE.Vector3();
    const velocity = new THREE.Vector3();
    const zenith = new THREE.Vector3();
    const along = new THREE.Vector3();
    const side = new THREE.Vector3();
    const offsetGoal = new THREE.Vector3();
    const offset = new THREE.Vector3();
    const worldUp = new THREE.Vector3(0, 1, 0);
    let wasFollowing = false;
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
      const visible = layersRef.current;
      auroraLayer.mesh.visible = visible.aurora && auroraAvailableRef.current;
      sepLayer.mesh.visible = visible.protons;
      groundTrack.visible = visible.track;
      const saaMesh = saaLayerRef.current?.mesh;
      if (saaMesh) {
        saaMesh.visible = visible.saa;
      }
      const sun = sunAt(simTimeMs);
      kmToScene(sun.unit, sunScene);
      earth.setSunDirection(sunScene);

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
      const ahead = starmindAtUtc(orbit, simTimeMs + 1000);
      kmToScene({ x: ahead.xKm, y: ahead.yKm, z: ahead.zKm }, nextAt);
      velocity.subVectors(nextAt, craftAt);
      updateOrbitRing(ring, orbit, simTimeMs);
      if (groundTrack.visible) {
        updateGroundTrack(groundTrack, groundTrackAtUtc(orbit, simTimeMs, stormRef.current, saaTestRef.current));
      }

      sunKm.x = sun.unit.x * SHADOW_AU_KM;
      sunKm.y = sun.unit.y * SHADOW_AU_KM;
      sunKm.z = sun.unit.z * SHADOW_AU_KM;
      const sample = sampleAt(timeline.points, simTimeMs);
      const shadow = shadowKind({ x: fix.xKm, y: fix.yKm, z: fix.zKm }, sunKm);
      craft.setScale(craftScaleRef.current);
      craft.update(craftAt, velocity, sunScene, shadow);
      hudRef.current = {
        utcMs: simTimeMs,
        latDeg: fix.latDeg,
        lonDeg: fix.lonDeg,
        altKm: fix.altKm,
        exposure: exposureClass(fix.latDeg, fix.lonDeg, fix.altKm, stormRef.current, saaTestRef.current),
        shadow,
        kp: sample.kp,
        protonPfu: sample.protonPfu,
      };

      const following = followRef.current;
      const size = craft.sizeScene();
      if (following) {
        // Chase view in the craft's own frame, horizon level. The offset (not the position) is eased, so the camera
        // keeps up at any playback speed.
        controls.enabled = false;
        zenith.copy(craftAt).normalize();
        along.copy(velocity).addScaledVector(zenith, -velocity.dot(zenith)).normalize();
        side.crossVectors(along, zenith);
        const distance = size * (zoomRef.current / 2.6);
        offsetGoal
          .copy(along)
          .multiplyScalar(-FOLLOW_OFFSET.back * distance)
          .addScaledVector(zenith, FOLLOW_OFFSET.up * distance)
          .addScaledVector(side, FOLLOW_OFFSET.side * distance);
        if (!wasFollowing) {
          offset.subVectors(camera.position, craftAt);
        }
        offset.lerp(offsetGoal, 1 - Math.exp(-FOLLOW_RATE * dt));
        camera.position.copy(craftAt).add(offset);
        camera.up.copy(zenith);
        camera.lookAt(craftAt);
      } else {
        if (wasFollowing) {
          camera.up.copy(worldUp);
          camera.position.setLength(zoomRef.current * FREE_DISTANCE_PER_ZOOM);
        }
        controls.enabled = true;
        if (zoomChangedRef.current) {
          camera.position.setLength(zoomRef.current * FREE_DISTANCE_PER_ZOOM);
          zoomChangedRef.current = false;
        }
        controls.update();
      }
      wasFollowing = following;

      // Pass 1: the world. Pass 2: the craft. When following, the craft pass gets a fresh depth buffer and a near
      // plane scaled to the craft, so even the true-scale 75 m model stays sharp. Otherwise it shares the world's
      // depth, so the Earth hides it when it is behind.
      renderer.clear();
      camera.near = following ? WORLD_NEAR : 0.01;
      camera.far = 200;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      if (following) {
        renderer.clearDepth();
        camera.near = size * 0.01;
        camera.far = size * 400 + 1;
        camera.updateProjectionMatrix();
      }
      renderer.render(craft.scene, camera);
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
      for (const object of [stars, starlink, groundTrack, ring]) {
        disposeObject(object);
      }
      auroraLayer.dispose();
      sepLayer.dispose();
      auroraLayerRef.current = null;
      sepLayerRef.current = null;
      groundTrackRef.current = null;
      craft.dispose();
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
        <GlobeHud stateRef={hudRef} playing={playing} speedLabel={SPEED_LABELS[speed]} note={scaleLabel(craftScale)} />
        {phase === "loading" ? <p className="globe__status rok-muted">Loading</p> : null}
        {phase === "error" ? <p className="globe__status error">{error ?? "Error"}</p> : null}
        {phase === "empty" ? <p className="globe__status rok-muted">Empty</p> : null}
      </div>
      <LayerToggles layers={layers} onChange={setLayers} />
      <OrbitTrail />
      <CameraControls
        follow={follow}
        onFollow={setFollow}
        scale={craftScale}
        onScale={setCraftScale}
        onZoom={(direction) => {
          zoomRef.current = Math.min(6, Math.max(1.3, zoomRef.current + direction * -0.3));
          zoomChangedRef.current = true;
        }}
      />
      <p className="note">
        Day side, night side and terminator follow the Sun at the timeline time; the Earth turns by sidereal time.
        Starlink points are subsampled ({count} shown)
        {starlinkOn ? "" : " and hidden during historical replays, since today's elements cannot place them then"}.
        OVATION display cutoff {AURORA_CUTOFF}% is an estimate. Hover a layer for its source. Stars are decorative.
        {tickMs !== null ? ` Worker tick ${tickMs.toFixed(1)} ms.` : ""}
      </p>
    </div>
  );
}
