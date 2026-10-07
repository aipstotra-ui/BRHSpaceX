import { describe, expect, it } from "vitest";

import { exposureClass } from "@/lib/engine/globe/exposure";

describe("exposure classification", () => {
  it("labels SAA, auroral, and nominal points", () => {
    // 29°S 47°W is the core of the AP8 SAA at 500 km (protonMap.test.ts).
    expect(exposureClass(-29, -47, 500)).toBe("SAA");
    expect(exposureClass(70, 20, 500)).toBe("auroral");
    expect(exposureClass(10, 20, 500)).toBe("nominal");
  });
});
