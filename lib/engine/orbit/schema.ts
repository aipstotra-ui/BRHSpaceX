import { z } from "zod";

import { FCC_ALT_MAX_KM, FCC_ALT_MIN_KM } from "@/lib/engine/orbit/constants";

/** FCC filing slider. The derived demo altitude is not parsed with this schema. */
export const fccAltitudeSchema = z.number().gte(FCC_ALT_MIN_KM).lte(FCC_ALT_MAX_KM);

export const inclinationSchema = z.number().gte(0).lte(180);

export const ltanSchema = z.number().gte(0).lt(24);

export const orbitSliderSchema = z.object({
  altitudeKm: fccAltitudeSchema,
  inclinationDeg: inclinationSchema,
  ltanHours: ltanSchema,
});
