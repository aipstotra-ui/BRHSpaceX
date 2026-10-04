import type { CaseInputs } from "@/lib/cases/schema";
import { useShellStore } from "@/lib/store";
import { useOrbitStore } from "@/lib/store/orbit";

/** Read the inputs a case keeps out of the two input stores. */
export function captureInputs(): CaseInputs {
  const shell = useShellStore.getState();
  const orbit = useOrbitStore.getState();
  return {
    chip: { presetId: shell.presetId, spec: shell.spec, payload: shell.payload },
    orbit: {
      altitudeKm: orbit.altitudeKm,
      inclinationDeg: orbit.inclinationDeg,
      sunSynchronous: orbit.sunSynchronous,
      ltanHours: orbit.ltanHours,
      raanDeg: orbit.raanDeg,
      preset: orbit.preset,
      vehicle: orbit.vehicle,
    },
  };
}

/**
 * Put a case's inputs into the two input stores. The orbit setters mark the preset "custom", so
 * the orbit goes in with setState to keep the preset the case was saved with.
 */
export function applyInputs(inputs: CaseInputs): void {
  useShellStore.getState().setStudio(inputs.chip);
  useOrbitStore.setState(inputs.orbit);
}
