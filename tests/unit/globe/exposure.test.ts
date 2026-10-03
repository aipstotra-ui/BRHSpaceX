import { describe, expect, it } from "vitest";

import { exposureClass } from "@/lib/engine/globe/exposure";
import { inSaa } from "@/lib/engine/radiation";

describe("exposure classification", () => {
  it("labels SAA, auroral, and nominal points", () => {
    let saa: { lat: number; lon: number } | null = null;
    for (let lat = -28; lat <= 1; lat += 1) {
      for (let lon = -90; lon <= 30; lon += 1) {
        if (inSaa(lat, lon)) {
          saa = { lat, lon };
          break;
        }
      }
      if (saa) {
        break;
      }
    }
    if (!saa) {
      throw new Error("no SAA fixture");
    }
    expect(exposureClass(saa.lat, saa.lon, 500)).toBe("SAA");
    expect(exposureClass(70, 20, 500)).toBe("auroral");
    expect(exposureClass(10, 20, 500)).toBe("nominal");
  });
});
