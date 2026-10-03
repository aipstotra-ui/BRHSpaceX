import { describe, expect, it } from "vitest";

import { dipoleL, inSaa, omnidirectionalQuietFlux } from "@/lib/engine/radiation";
import { estimatedStormMultiplier } from "@/lib/engine/upsets";

describe("radiation geometry", () => {
  it("classifies the Fermi GBM SAA polygon", () => {
    expect(inSaa(-20, -40)).toBe(true);
    expect(inSaa(0, 0)).toBe(false);
    expect(inSaa(40, 10)).toBe(false);
  });

  it("uses the dipole identity L = R / cos^2(Lambda)", () => {
    expect(dipoleL(1, 0)).toBeCloseTo(1);
    expect(dipoleL(1, Math.PI / 4)).toBeCloseTo(2);
  });

  it("keeps the 4π conversion and the Kp multiplier as estimates", () => {
    const flux = omnidirectionalQuietFlux();
    expect(flux.isEstimate).toBe(true);
    expect(flux.label).toBe("estimate");
    expect(flux.value).toBeCloseTo(399.5 * 4 * Math.PI);
    expect(estimatedStormMultiplier(2).value).toBeCloseTo(1);
    expect(estimatedStormMultiplier(4).value).toBeCloseTo(1.1);
    expect(estimatedStormMultiplier(4).isEstimate).toBe(true);
  });
});
