import { describe, expect, it } from "vitest";

import { demoReferenceSaa, orbitEnvironment } from "@/lib/engine/orbit/environment";

function saaAt(altitudeKm: number, inclinationDeg: number): number {
  return orbitEnvironment({ altitudeKm, inclinationDeg, sunSynchronous: false, ltanHours: null, raanDeg: 0 }).saaFraction
    .mid;
}

describe("SAA fraction (AP8 contour)", () => {
  it("agrees with the Fermi GBM polygon at low inclination, where the polygon is complete", () => {
    // 550 km at 20°: the orbit stays inside the ±26° band the polygon was drawn for (polygon: 12.3 %).
    expect(Math.abs(saaAt(550, 20) - 0.123)).toBeLessThan(0.03);
  });

  it("counts the SAA south of 30°S, which the polygon leaves out, at mid inclinations", () => {
    // The polygon gives 5.3 % at 53° for any altitude.
    expect(saaAt(500, 53)).toBeGreaterThan(0.1);
  });

  it("grows with altitude, as the inner belt reaches lower field strengths", () => {
    const fractions = [500, 800, 1200, 1600, 2000].map((altitude) => saaAt(altitude, 53));
    for (let index = 1; index < fractions.length; index += 1) {
      expect(fractions[index]).toBeGreaterThan(fractions[index - 1]);
    }
  });

  it("notes when the altitude is outside the map", () => {
    const inside = orbitEnvironment({ altitudeKm: 550, inclinationDeg: 53, sunSynchronous: false, ltanHours: null, raanDeg: 0 });
    expect(inside.saaFraction.assumptions.some((line) => line.includes("outside the map"))).toBe(false);
    const below = orbitEnvironment({ altitudeKm: 250, inclinationDeg: 53, sunSynchronous: false, ltanHours: null, raanDeg: 0 });
    expect(below.saaFraction.assumptions.some((line) => line.includes("read at 300 km"))).toBe(true);
  });

  it("keeps the cost model's reference scale on the GBM polygon", () => {
    // The AI policy's "saa" input and the replay costs were calibrated on this value.
    expect(demoReferenceSaa()).toBeCloseTo(0.05324, 4);
  });
});
