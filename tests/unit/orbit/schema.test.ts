import { describe, expect, it } from "vitest";

import { DERIVED_SHELL } from "@/lib/engine/orbit/derivedShell";
import { fccAltitudeSchema, inclinationSchema, ltanSchema, orbitSliderSchema } from "@/lib/engine/orbit/schema";

describe("orbit slider schema", () => {
  it("rejects altitude, inclination, and LTAN outside the slider domain", () => {
    expect(fccAltitudeSchema.safeParse(499).success).toBe(false);
    expect(fccAltitudeSchema.safeParse(2001).success).toBe(false);
    expect(fccAltitudeSchema.safeParse(500).success).toBe(true);
    expect(fccAltitudeSchema.safeParse(2000).success).toBe(true);
    expect(fccAltitudeSchema.safeParse(DERIVED_SHELL.meanAltitudeKm).success).toBe(false);
    expect(inclinationSchema.safeParse(-0.01).success).toBe(false);
    expect(inclinationSchema.safeParse(180.01).success).toBe(false);
    expect(inclinationSchema.safeParse(0).success).toBe(true);
    expect(inclinationSchema.safeParse(180).success).toBe(true);
    expect(ltanSchema.safeParse(-0.01).success).toBe(false);
    expect(ltanSchema.safeParse(24).success).toBe(false);
    expect(ltanSchema.safeParse(0).success).toBe(true);
    expect(ltanSchema.safeParse(23.999).success).toBe(true);
    expect(
      orbitSliderSchema.safeParse({ altitudeKm: 499, inclinationDeg: 53, ltanHours: 6 }).success,
    ).toBe(false);
  });
});
