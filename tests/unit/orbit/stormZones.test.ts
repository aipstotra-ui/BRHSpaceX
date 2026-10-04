import { describe, expect, it } from "vitest";

import { exposureClass } from "@/lib/engine/globe/exposure";
import { ssoInclinationDeg } from "@/lib/engine/orbit/sso";
import {
  auroralBoundaryMlatDeg,
  DIPOLE_POLE_LAT_DEG,
  DIPOLE_POLE_LON_DEG,
  magneticCircle,
  magneticLatitudeDeg,
  sepActive,
  sepCapFraction,
  sepCutoffMlatDeg,
  sscale,
  zoneFractions,
} from "@/lib/engine/orbit/stormZones";

describe("geomagnetic frame", () => {
  it("puts the dipole pole at 90° and its antipode at −90°", () => {
    expect(magneticLatitudeDeg(DIPOLE_POLE_LAT_DEG, DIPOLE_POLE_LON_DEG)).toBeCloseTo(90, 6);
    expect(magneticLatitudeDeg(-DIPOLE_POLE_LAT_DEG, DIPOLE_POLE_LON_DEG + 180)).toBeCloseTo(-90, 6);
  });

  it("traces rings that sit at the requested magnetic latitude", () => {
    for (const north of [true, false]) {
      for (const point of magneticCircle(60, north, 36)) {
        expect(Math.abs(magneticLatitudeDeg(point.latDeg, point.lonDeg))).toBeCloseTo(60, 6);
      }
    }
  });
});

describe("storm-dependent zones", () => {
  it("moves the auroral edge and proton cutoff equatorward as Kp rises", () => {
    expect(auroralBoundaryMlatDeg(9)).toBeLessThan(auroralBoundaryMlatDeg(2));
    expect(sepCutoffMlatDeg(9)).toBeLessThan(sepCutoffMlatDeg(2));
  });

  it("classifies S-levels and proton events from GOES flux", () => {
    expect(sscale(0.3)).toBe("S0");
    expect(sscale(10)).toBe("S1");
    expect(sscale(208)).toBe("S2");
    expect(sepActive(9.9)).toBe(false);
    expect(sepActive(10)).toBe(true);
  });

  it("exposes more of a dawn-dusk SSO than a 53° orbit, and more in a G5 storm", () => {
    const shell = { altitudeKm: 550, inclinationDeg: 53, sunSynchronous: false, ltanHours: null, raanDeg: 0 };
    const sso = { altitudeKm: 550, inclinationDeg: ssoInclinationDeg(550), sunSynchronous: true, ltanHours: 6, raanDeg: 0 };
    expect(zoneFractions(sso, 2).sepCap).toBeGreaterThan(zoneFractions(shell, 2).sepCap);
    expect(zoneFractions(sso, 9).sepCap).toBeGreaterThan(zoneFractions(sso, 2).sepCap);
    expect(zoneFractions(shell, 9).auroral).toBeGreaterThan(zoneFractions(shell, 2).auroral);
  });

  it("only counts the proton cap during an S1+ event", () => {
    const orbit = { altitudeKm: 550, inclinationDeg: 97.6 };
    expect(sepCapFraction(orbit, 5, 1)).toBe(0);
    expect(sepCapFraction(orbit, 5, 100)).toBeGreaterThan(0);
  });

  it("marks a polar point as SEP only while protons are elevated", () => {
    expect(exposureClass(85, 0, 550, { kp: 2, protonPfu: 0.2 })).not.toBe("SEP");
    expect(exposureClass(85, 0, 550, { kp: 2, protonPfu: 200 })).toBe("SEP");
  });
});
