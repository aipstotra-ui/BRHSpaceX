import { geographicDipoleL, inAuroralZone, inOuterBelt } from "@/lib/engine/orbit/lshell";
import { inSaaGeographic } from "@/lib/engine/orbit/saa";
import { RE_M } from "@/lib/engine/orbit/constants";
import { inAuroralOval, inSepCap, magneticDipoleL } from "@/lib/engine/orbit/stormZones";

export type ExposureClass = "SAA" | "SEP" | "auroral" | "outer belt" | "nominal";

export const EXPOSURE_COLORS: Record<ExposureClass, string> = {
  SAA: "#e23b3b",
  SEP: "#ff5fd2",
  auroral: "#3ddc97",
  "outer belt": "#e0a100",
  nominal: "#8fb4d6",
};

export const EXPOSURE_LABELS: Record<ExposureClass, string> = {
  SAA: "SAA",
  SEP: "solar protons",
  auroral: "auroral",
  "outer belt": "outer belt",
  nominal: "nominal",
};

/** Space-weather state used to place the storm-dependent zones. */
export interface StormContext {
  kp: number;
  /** GOES integral flux above 10 MeV, pfu. Null when unknown. */
  protonPfu: number | null;
  /** Live OVATION test for "now". When given it replaces the Kp oval model. */
  inOvation?: (latDeg: number, lonDeg: number) => boolean;
}

/**
 * SAA wins, then the solar-proton polar cap (only during an S1+ event), then the auroral zone, then the outer belt.
 * Without a storm context the zones are the fixed NASA SP-8116 latitude bands used since M5.
 */
export function exposureClass(latDeg: number, lonDeg: number, altitudeKm: number, storm?: StormContext): ExposureClass {
  if (inSaaGeographic(latDeg, lonDeg)) {
    return "SAA";
  }
  const radiusM = RE_M + altitudeKm * 1000;
  if (!storm) {
    if (inAuroralZone(latDeg)) {
      return "auroral";
    }
    return inOuterBelt(geographicDipoleL(radiusM, latDeg)) ? "outer belt" : "nominal";
  }
  if (inSepCap(latDeg, lonDeg, storm.kp, storm.protonPfu)) {
    return "SEP";
  }
  const auroral = storm.inOvation ? storm.inOvation(latDeg, lonDeg) : inAuroralOval(latDeg, lonDeg, storm.kp);
  if (auroral) {
    return "auroral";
  }
  return inOuterBelt(magneticDipoleL(radiusM, latDeg, lonDeg)) ? "outer belt" : "nominal";
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
  if (kind === "SEP") {
    return 4;
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
  if (code === 4) {
    return "SEP";
  }
  return "nominal";
}
