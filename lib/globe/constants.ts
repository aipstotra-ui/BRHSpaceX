import { RE_M } from "@/lib/engine/orbit/constants";

/**
 * WGS 84 equatorial radius in km. One source: RE_M, from NGA WGS 84
 * (docs/research/engine-constants.md, "Earth equatorial radius R_E").
 */
export const EARTH_EQUATORIAL_RADIUS_KM = RE_M / 1000;
