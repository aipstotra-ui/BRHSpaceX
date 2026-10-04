import type { CaseInputs } from "@/lib/cases/schema";
import {
  VEHICLE_CD,
  VEHICLE_DRAG_AREA_M2,
  VEHICLE_EOL_KM,
  VEHICLE_MASS_KG,
} from "@/lib/engine/orbit/constants";
import { DERIVED_SHELL } from "@/lib/engine/orbit/derivedShell";
import { DEFAULT_PRESET_ID, getPreset } from "@/lib/presets";

/**
 * What a new case starts from, and what the testing page flies when no case is named. These are the
 * values the two input stores start with; a test keeps the two from drifting apart.
 */
export function defaultInputs(): CaseInputs {
  const chip = getPreset(DEFAULT_PRESET_ID);
  return structuredClone({
    chip: { presetId: chip.id, spec: chip.spec, payload: chip.payload },
    orbit: {
      altitudeKm: DERIVED_SHELL.meanAltitudeKm,
      inclinationDeg: DERIVED_SHELL.meanInclinationDeg,
      sunSynchronous: false,
      ltanHours: null,
      raanDeg: 0,
      preset: "initial" as const,
      vehicle: {
        massKg: VEHICLE_MASS_KG,
        dragAreaM2: VEHICLE_DRAG_AREA_M2,
        cd: VEHICLE_CD,
        eolAltitudeKm: VEHICLE_EOL_KM,
      },
    },
  });
}
