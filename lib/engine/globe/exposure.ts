import { geographicDipoleL, inAuroralZone, inOuterBelt } from "@/lib/engine/orbit/lshell";
import { inSaaGeographic } from "@/lib/engine/orbit/saa";
import { RE_M } from "@/lib/engine/orbit/constants";

export type ExposureClass = "SAA" | "auroral" | "outer belt" | "nominal";

export const EXPOSURE_COLORS: Record<ExposureClass, string> = {
  SAA: "#e23b3b",
  auroral: "#3ddc97",
  "outer belt": "#e0a100",
  nominal: "#8fb4d6",
};

/** SAA wins, then the auroral zone, then the outer belt. */
export function exposureClass(latDeg: number, lonDeg: number, altitudeKm: number): ExposureClass {
  if (inSaaGeographic(latDeg, lonDeg)) {
    return "SAA";
  }
  if (inAuroralZone(latDeg)) {
    return "auroral";
  }
  const radiusM = RE_M + altitudeKm * 1000;
  if (inOuterBelt(geographicDipoleL(radiusM, latDeg))) {
    return "outer belt";
  }
  return "nominal";
}

export function exposureCode(kind: ExposureClass): number {
  if (kind === "SAA") {
    return 1;
  }
  if (kind === "auroral") {
    return 2;
  }
  if (kind === "outer belt") {
    return 3;
  }
  return 0;
}

export function classFromCode(code: number): ExposureClass {
  if (code === 1) {
    return "SAA";
  }
  if (code === 2) {
    return "auroral";
  }
  if (code === 3) {
    return "outer belt";
  }
  return "nominal";
}
