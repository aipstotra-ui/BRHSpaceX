import { describe, expect, it } from "vitest";

import { chipSpecSchema, payloadConfigSchema } from "@/lib/schemas/chipSpec";

// Schema fixtures. Not physical values.
const chip = {
  vendor: "example",
  name: "example",
  nodeNm: 0,
  acceleratorCount: 0,
  cpuCount: 0,
  memoryType: "example",
  memoryCapacity: 0,
  eccScheme: "example",
  avgPowerKw: 0,
  peakPowerKw: 0,
  opTempMinC: 0,
  opTempMaxC: 0,
  shieldingMmAl: 0,
};

describe("chipSpecSchema", () => {
  it("rejects an empty object", () => {
    expect(chipSpecSchema.safeParse({}).success).toBe(false);
  });

  it("accepts the required fields", () => {
    expect(chipSpecSchema.safeParse(chip).success).toBe(true);
  });

  it("accepts the optional fields when present", () => {
    const parsed = chipSpecSchema.safeParse({
      ...chip,
      seuCrossSection: 0,
      tidLimitKradSi: 0,
      latchupLet: 0,
      dieArea: 0,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("payloadConfigSchema", () => {
  it("accepts one-sided and two-sided radiators", () => {
    for (const radiatorSides of [1, 2] as const) {
      const parsed = payloadConfigSchema.safeParse({
        radiatorAreaM2: 0,
        radiatorSides,
        tSinkK: 0,
        emissivity: 0,
      });
      expect(parsed.success).toBe(true);
    }
  });

  it("rejects a side count outside the schema", () => {
    const parsed = payloadConfigSchema.safeParse({
      radiatorAreaM2: 0,
      radiatorSides: 0,
      tSinkK: 0,
      emissivity: 0,
    });
    expect(parsed.success).toBe(false);
  });
});
