import { describe, expect, it } from "vitest";

import { lerpScene } from "@/lib/engine/globe/interpolate";

describe("starlink interpolation", () => {
  it("blends scene positions halfway between ticks", () => {
    const from = new Float32Array([0, 0, 0]);
    const to = new Float32Array([2, 4, 6]);
    const out = new Float32Array(3);
    expect(lerpScene(from, to, 0.5, out)).toBe(1);
    expect(Array.from(out)).toEqual([1, 2, 3]);
    lerpScene(from, to, 2, out);
    expect(Array.from(out)).toEqual([2, 4, 6]);
  });
});
