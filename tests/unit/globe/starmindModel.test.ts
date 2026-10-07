import { readFileSync } from "node:fs";

import { getBounds, NodeIO } from "@gltf-transform/core";
import { describe, expect, it } from "vitest";

describe("starmind.glb", () => {
  it("keeps the sourced dimensions: 75 m wingspan, 30 m height, 840 m² of cells, 160 m² of radiator", async () => {
    const doc = await new NodeIO().readBinary(new Uint8Array(readFileSync("public/models/starmind.glb")));
    const scene = doc.getRoot().listScenes()[0];
    const { min, max } = getBounds(scene);
    expect(max[2] - min[2]).toBeCloseTo(75, 1);
    expect(max[1] - min[1]).toBeCloseTo(30, 1);

    const names = doc.getRoot().listNodes().map((node) => node.getName());
    expect(names).toEqual(expect.arrayContaining(["Starmind", "WingPivot+", "WingPivot-", "PhasedArray"]));

    const area = (prefix: RegExp) =>
      doc
        .getRoot()
        .listNodes()
        .filter((node) => prefix.test(node.getName()))
        .reduce((sum, node) => {
          const { min: lo, max: hi } = getBounds(node);
          const extents = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]].sort((a, b) => b - a);
          return sum + extents[0] * extents[1];
        }, 0);
    expect(area(/^Wing[+-]$/)).toBeCloseTo(840, 0);
    expect(area(/^Radiator[+-]$/)).toBeCloseTo(160, 0);
  });
});
