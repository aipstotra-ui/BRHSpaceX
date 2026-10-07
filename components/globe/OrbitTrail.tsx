"use client";

import * as THREE from "three";

import { EXPOSURE_COLORS, EXPOSURE_LABELS, type ExposureClass } from "@/lib/engine/globe/exposure";
import { geodeticToScene } from "@/lib/engine/globe/frames";
import { GROUND_TRACK_ORBITS } from "@/lib/engine/globe/trail";

/** Scene position of a geodetic point, using the one frame convention in lib/engine/globe/frames.ts. */
export function surfaceVector(latDeg: number, lonDeg: number, altKm: number, out = new THREE.Vector3()): THREE.Vector3 {
  geodeticToScene(latDeg, lonDeg, altKm, out);
  return out;
}

export function OrbitTrail() {
  return (
    <div className="legend">
      <ul className="legend__items" aria-label="Trail colors">
        {(Object.keys(EXPOSURE_COLORS) as ExposureClass[]).map((kind) => (
          <li key={kind} className="eyebrow">
            <span className="swatch" style={{ background: EXPOSURE_COLORS[kind] }} aria-hidden="true" />
            {EXPOSURE_LABELS[kind]}
          </li>
        ))}
      </ul>
      <p className="note">
        Ring: the orbit in space, a closed loop the Earth turns under. Colored line: the ground track of the last{" "}
        {GROUND_TRACK_ORBITS} orbits, fading with age. Shaded bands: SAA, auroral oval for the timeline Kp, and the
        solar-proton cap during S1+ events.
      </p>
    </div>
  );
}
