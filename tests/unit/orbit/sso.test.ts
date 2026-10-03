import { describe, expect, it } from "vitest";

import { SSO_TOLERANCE_DEG } from "@/lib/engine/orbit/constants";
import { ssoInclinationDeg } from "@/lib/engine/orbit/sso";

const references = [
  { altitudeKm: 700, publishedDeg: 98.2 },
  { altitudeKm: 800, publishedDeg: 98.603 },
];

describe("SSO inclination", () => {
  it("stays within 0.05° of the published J2 references", () => {
    for (const reference of references) {
      const computed = ssoInclinationDeg(reference.altitudeKm);
      const residual = computed - reference.publishedDeg;
      console.log(`SSO residual ${reference.altitudeKm} km: ${residual} deg (computed ${computed})`);
      expect(Math.abs(residual)).toBeLessThanOrEqual(SSO_TOLERANCE_DEG);
    }
  });
});
