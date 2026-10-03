import { AI1_ALTITUDE_ASSUMPTION } from "@/lib/engine/orbit/constants";
import { meanMotionRadS, raanFromLtan, semiMajorM, ssoInclinationDeg } from "@/lib/engine/orbit/sso";

export interface OrbitRequest {
  altitudeKm: number;
  inclinationDeg: number;
  sunSynchronous: boolean;
  ltanHours: number | null;
  raanDeg: number;
}

export interface OrbitElements {
  altitudeKm: number;
  inclinationDeg: number;
  sunSynchronous: boolean;
  ltanHours: number | null;
  raanDeg: number;
  semiMajorM: number;
  meanMotionRadS: number;
  periodS: number;
  assumption: string | null;
}

export function circularElements(request: OrbitRequest, sunRightAscensionDeg = 0): OrbitElements {
  const inclinationDeg = request.sunSynchronous ? ssoInclinationDeg(request.altitudeKm) : request.inclinationDeg;
  const raanDeg = request.sunSynchronous
    ? raanFromLtan(request.ltanHours ?? 6, sunRightAscensionDeg)
    : request.raanDeg;
  const motion = meanMotionRadS(request.altitudeKm);
  return {
    altitudeKm: request.altitudeKm,
    inclinationDeg,
    sunSynchronous: request.sunSynchronous,
    ltanHours: request.sunSynchronous ? (request.ltanHours ?? 6) : null,
    raanDeg,
    semiMajorM: semiMajorM(request.altitudeKm),
    meanMotionRadS: motion,
    periodS: (2 * Math.PI) / motion,
    assumption: null,
  };
}

export function withAssumption(elements: OrbitElements, derivedAltitudeKm: number): OrbitElements {
  if (Math.abs(elements.altitudeKm - derivedAltitudeKm) < 1e-6) {
    return { ...elements, assumption: AI1_ALTITUDE_ASSUMPTION };
  }
  return elements;
}
