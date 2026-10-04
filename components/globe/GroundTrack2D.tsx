"use client";

import { useEffect, useRef, type RefObject } from "react";

import { exposureColorHex, hexToRgb, shellColorHex } from "@/components/globe/palette";
import type { GlobeSample } from "@/components/globe/useGlobeSim";
import { auroraProxyPoints } from "@/lib/globe/aurora";
import { starlinkRecords } from "@/lib/globe/starlinkDemo";
import { saaRings } from "@/lib/engine/saaContour";

interface LandGeometry {
  type: string;
  coordinates: number[][][] | number[][][][];
}

function project(lon: number, lat: number, width: number, height: number): [number, number] {
  return [((lon + 180) / 360) * width, ((90 - lat) / 180) * height];
}

export function GroundTrack2D({
  altitudeKm,
  sampleRef,
}: {
  altitudeKm: number;
  sampleRef: RefObject<GlobeSample>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landRef = useRef<LandGeometry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/earth/ne_110m_land.geojson")
      .then((response) => response.json())
      .then((payload: { features: { geometry: LandGeometry }[] }) => {
        if (!cancelled) {
          landRef.current = payload.features.map((feature) => feature.geometry);
        }
      })
      .catch(() => {
        landRef.current = [];
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const records = starlinkRecords();
    const aurora = auroraProxyPoints();
    let frame = 0;
    const draw = () => {
      const parent = canvas.parentElement;
      const width = Math.max(320, parent?.clientWidth ?? 640);
      const height = Math.max(200, Math.round(width / 2));
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.round(width * ratio);
      const pixelHeight = Math.round(height * ratio);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.fillStyle = "#000000";
      context.fillRect(0, 0, width, height);
      context.strokeStyle = "#2c2f33";
      context.lineWidth = 1;
      for (let lon = -180; lon <= 180; lon += 30) {
        const [x] = project(lon, 0, width, height);
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      for (let lat = -60; lat <= 60; lat += 30) {
        const [, y] = project(0, lat, width, height);
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }
      context.fillStyle = "#17191b";
      for (const geometry of landRef.current ?? []) {
        const polygons = geometry.type === "Polygon" ? [geometry.coordinates as number[][][]] : (geometry.coordinates as number[][][][]);
        for (const polygon of polygons) {
          const ring = polygon[0];
          if (!ring) {
            continue;
          }
          context.beginPath();
          ring.forEach((pair, index) => {
            const [x, y] = project(pair[0], pair[1], width, height);
            if (index === 0) {
              context.moveTo(x, y);
            } else {
              context.lineTo(x, y);
            }
          });
          context.closePath();
          context.fill();
        }
      }
      context.strokeStyle = "#ff6a45";
      context.lineWidth = 1.5;
      for (const ring of saaRings(altitudeKm)) {
        context.beginPath();
        ring.forEach((pair, index) => {
          const [x, y] = project(pair[0], pair[1], width, height);
          if (index === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        });
        context.stroke();
      }
      context.fillStyle = "rgba(78, 193, 245, 0.9)";
      for (const point of aurora) {
        const [x, y] = project(point.lonDeg, point.latDeg, width, height);
        context.fillRect(x, y, 2, 2);
      }
      const starlink = sampleRef.current?.starlink;
      if (starlink) {
        for (let index = 0; index < records.length; index += 1) {
          const lat = starlink[index * 3];
          const lng = starlink[index * 3 + 1];
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            continue;
          }
          const color = shellColorHex(records[index].shellDeg, records[index].raisingOrDeorbiting);
          const [r, g, b] = hexToRgb(color);
          context.fillStyle = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
          const [x, y] = project(lng, lat, width, height);
          context.fillRect(x, y, 2, 2);
        }
      }
      const trail = sampleRef.current?.trail ?? [];
      for (const sample of trail) {
        const color = exposureColorHex(sample.exposure);
        const [r, g, b] = hexToRgb(color);
        context.fillStyle = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
        const [x, y] = project(sample.lngDeg, sample.latDeg, width, height);
        context.fillRect(x - 1, y - 1, 3, 3);
      }
      const starmind = sampleRef.current?.starmind;
      if (starmind) {
        const [x, y] = project(starmind.lngDeg, starmind.latDeg, width, height);
        context.strokeStyle = "#ffffff";
        context.lineWidth = 2;
        context.strokeRect(x - 5, y - 5, 10, 10);
        context.fillStyle = "#4ec1f5";
        context.fillRect(x - 2, y - 2, 4, 4);
      }
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [altitudeKm, sampleRef]);

  return <canvas ref={canvasRef} aria-label="2D ground track" />;
}
