import * as satellite from "satellite.js";
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { gmstRad, geodeticToScene, kmToScene, sunAt } from "@/lib/engine/globe/frames";
import { GROUND_TRACK_SAMPLES, groundTrackAtUtc } from "@/lib/engine/globe/trail";
import { argumentRateRadPerSec, ORBIT_EPOCH_MS, raanAtUtc, starmindAtUtc, type StarmindOrbit } from "@/lib/engine/orbit/j2";
import { ssoInclinationDeg } from "@/lib/engine/orbit/sso";

const shell: StarmindOrbit = { altitudeKm: 550, inclinationDeg: 53, sunSynchronous: false, ltanHours: null, raanDeg: 40 };
const dawnDusk: StarmindOrbit = {
  altitudeKm: 600,
  inclinationDeg: ssoInclinationDeg(600),
  sunSynchronous: true,
  ltanHours: 18,
  raanDeg: 0,
};

function wrap180(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

/** Kozai mean motion (rad/min) whose SGP4-recovered Brouwer mean motion is the given one. WGS-72, as SGP4 uses. */
function kozaiFor(brouwerRadMin: number, inclinationDeg: number): number {
  const xke = 60 / Math.sqrt(6378.135 ** 3 / 398600.8);
  const k2 = 0.5 * 0.001082616;
  const c = Math.cos((inclinationDeg * Math.PI) / 180);
  let n0 = brouwerRadMin;
  for (let i = 0; i < 6; i += 1) {
    const a1 = (xke / n0) ** (2 / 3);
    const d1 = (1.5 * k2 * (3 * c * c - 1)) / (a1 * a1);
    const a0 = a1 * (1 - d1 / 3 - d1 * d1 - (134 / 81) * d1 ** 3);
    const d0 = (1.5 * k2 * (3 * c * c - 1)) / (a0 * a0);
    n0 = brouwerRadMin * (1 + d0);
  }
  return n0;
}

describe("scene frame", () => {
  it("puts every geodetic point on the pixel three.js maps the equirectangular texture to", () => {
    const sphere = new THREE.SphereGeometry(1, 72, 36);
    const position = sphere.getAttribute("position");
    const uv = sphere.getAttribute("uv");
    let checked = 0;
    for (let index = 0; index < uv.count; index += 1) {
      const u = uv.getX(index);
      const v = uv.getY(index);
      // Skip the poles, where longitude is undefined.
      if (v < 0.01 || v > 0.99) {
        continue;
      }
      const lonDeg = u * 360 - 180;
      const latDeg = v * 180 - 90;
      const expected = geodeticToScene(latDeg, lonDeg, 0);
      expect(position.getX(index)).toBeCloseTo(expected.x, 6);
      expect(position.getY(index)).toBeCloseTo(expected.y, 6);
      expect(position.getZ(index)).toBeCloseTo(expected.z, 6);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(2000);
  });

  it("is not mirrored: 90°E lies at -z, and kilometres map with the same axes", () => {
    const east = geodeticToScene(0, 90, 0);
    expect(east.x).toBeCloseTo(0, 9);
    expect(east.z).toBeCloseTo(-1, 9);
    const fromKm = kmToScene({ x: 0, y: 6378.137, z: 0 });
    expect(fromKm.z).toBeCloseTo(-1, 9);
  });
});

describe("time", () => {
  it("GMST matches satellite.js and the J2000 value", () => {
    const at = Date.UTC(2024, 4, 10, 17, 30);
    expect(gmstRad(at)).toBeCloseTo(satellite.gstime(new Date(at)), 9);
    // GMST at 2000-01-01 12:00 UT1 is 280.46061837° (IAU 1982).
    expect((gmstRad(ORBIT_EPOCH_MS) * 180) / Math.PI).toBeCloseTo(280.46061837, 5);
  });

  it("puts the Sun on the equator at the March equinox and at +23.44° at the June solstice", () => {
    expect(Math.abs(sunAt(Date.UTC(2024, 2, 20, 3, 6)).declinationDeg)).toBeLessThan(0.02);
    expect(sunAt(Date.UTC(2024, 5, 20, 20, 51)).declinationDeg).toBeCloseTo(23.44, 1);
    const unit = sunAt(Date.UTC(2024, 5, 20, 20, 51)).unit;
    expect(Math.hypot(unit.x, unit.y, unit.z)).toBeCloseTo(1, 12);
  });
});

describe("Starmind at an absolute time", () => {
  for (const orbit of [shell, dawnDusk]) {
    it(`stays within 25 km of SGP4 over a day (i = ${orbit.inclinationDeg.toFixed(1)}°)`, () => {
      const epoch = Date.UTC(2024, 4, 10, 17);
      const rate = argumentRateRadPerSec(orbit.altitudeKm, orbit.inclinationDeg);
      const u0 = (((rate * (epoch - ORBIT_EPOCH_MS)) / 1000) * 180) / Math.PI;
      const brouwer = Math.sqrt(398600.4418 / (6378.137 + orbit.altitudeKm) ** 3) * 60;
      const satrec = satellite.json2satrec({
        OBJECT_NAME: "STARMIND TEST",
        OBJECT_ID: "2000-001A",
        EPOCH: new Date(epoch).toISOString().replace("Z", ""),
        MEAN_MOTION: (kozaiFor(brouwer, orbit.inclinationDeg) * 1440) / (2 * Math.PI),
        ECCENTRICITY: 0,
        INCLINATION: orbit.inclinationDeg,
        RA_OF_ASC_NODE: raanAtUtc(orbit, epoch),
        ARG_OF_PERICENTER: 0,
        MEAN_ANOMALY: ((u0 % 360) + 360) % 360,
        EPHEMERIS_TYPE: 0,
        CLASSIFICATION_TYPE: "U",
        NORAD_CAT_ID: 99999,
        ELEMENT_SET_NO: 999,
        REV_AT_EPOCH: 0,
        BSTAR: 0,
        MEAN_MOTION_DOT: 0,
        MEAN_MOTION_DDOT: 0,
      } as unknown as satellite.OMMJsonObjectV3);
      for (let minutes = 0; minutes <= 1440; minutes += 15) {
        const at = epoch + minutes * 60_000;
        const pv = satellite.propagate(satrec, new Date(at));
        if (!pv || typeof pv.position === "boolean") {
          throw new Error("SGP4 failed");
        }
        const ours = starmindAtUtc(orbit, at);
        const gap = Math.hypot(pv.position.x - ours.xKm, pv.position.y - ours.yKm, pv.position.z - ours.zKm);
        expect(gap).toBeLessThan(25);
      }
    });
  }

  it("sets the SSO node from LTAN against the true Sun, so LTAN moves the orbit", () => {
    const at = Date.UTC(2024, 4, 10, 17);
    const sunRa = sunAt(at).rightAscensionDeg;
    expect(wrap180(raanAtUtc(dawnDusk, at) - sunRa)).toBeCloseTo(90, 9);
    const dawn = { ...dawnDusk, ltanHours: 6 };
    expect(Math.abs(wrap180(raanAtUtc(dawn, at) - raanAtUtc(dawnDusk, at)))).toBeCloseTo(180, 9);
  });

  it("puts the inertial craft exactly over its ground point once the Earth group turns by GMST", () => {
    const earth = new THREE.Group();
    const at = Date.UTC(2024, 4, 10, 17, 42);
    for (const orbit of [shell, dawnDusk]) {
      const fix = starmindAtUtc(orbit, at);
      earth.rotation.y = gmstRad(at);
      earth.updateMatrixWorld(true);
      const ground = geodeticToScene(fix.latDeg, fix.lonDeg, fix.altKm);
      const fromEarth = new THREE.Vector3(ground.x, ground.y, ground.z).applyMatrix4(earth.matrixWorld);
      const inertial = kmToScene({ x: fix.xKm, y: fix.yKm, z: fix.zKm });
      expect(fromEarth.x).toBeCloseTo(inertial.x, 9);
      expect(fromEarth.y).toBeCloseTo(inertial.y, 9);
      expect(fromEarth.z).toBeCloseTo(inertial.z, 9);
    }
  });

  it("ends the ground track exactly at the craft", () => {
    const at = Date.UTC(2024, 4, 11, 0);
    const trail = groundTrackAtUtc(shell, at);
    const craft = starmindAtUtc(shell, at);
    expect(trail).toHaveLength(GROUND_TRACK_SAMPLES + 1);
    expect(trail[GROUND_TRACK_SAMPLES].latDeg).toBeCloseTo(craft.latDeg, 9);
    expect(trail[GROUND_TRACK_SAMPLES].lonDeg).toBeCloseTo(craft.lonDeg, 9);
  });

  it("moves continuously: one simulated minute moves the craft about 4°, not a jump", () => {
    const at = Date.UTC(2024, 4, 11, 0);
    const a = starmindAtUtc(shell, at);
    const b = starmindAtUtc(shell, at + 60_000);
    const angle = Math.acos((a.xKm * b.xKm + a.yKm * b.yKm + a.zKm * b.zKm) / (a.radiusKm * b.radiusKm));
    expect((angle * 180) / Math.PI).toBeGreaterThan(3.5);
    expect((angle * 180) / Math.PI).toBeLessThan(4.2);
  });
});
