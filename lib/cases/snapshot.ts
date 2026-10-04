import type { CaseInputs } from "@/lib/cases/schema";
import { useShellStore } from "@/lib/store";
import { useOrbitStore } from "@/lib/store/orbit";

type ShellSnapshot = ReturnType<typeof useShellStore.getState>;
type OrbitSnapshot = ReturnType<typeof useOrbitStore.getState>;

/** The inputs a case keeps, out of the two input stores' state. */
export function inputsFromStores(shell: ShellSnapshot, orbit: OrbitSnapshot): CaseInputs {
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

/** Read the inputs a case keeps out of the two input stores, as they stand now. */
export function captureInputs(): CaseInputs {
  return inputsFromStores(useShellStore.getState(), useOrbitStore.getState());
}

/**
 * Put a case's inputs into the two input stores. The orbit setters mark the preset "custom", so
 * the orbit goes in with setState to keep the preset the case was saved with.
 */
export function applyInputs(inputs: CaseInputs): void {
  useShellStore.getState().setStudio(inputs.chip);
  useOrbitStore.setState(inputs.orbit);
}
