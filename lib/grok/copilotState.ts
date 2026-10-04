import {
  VEHICLE_CD,
  VEHICLE_DRAG_AREA_M2,
  VEHICLE_EOL_KM,
  VEHICLE_MASS_KG,
} from "@/lib/engine/orbit/constants";
import { DERIVED_SHELL } from "@/lib/engine/orbit/derivedShell";
import type { Vehicle } from "@/lib/engine/orbit/lifetime";
import { DEFAULT_PRESET_ID, getPreset } from "@/lib/presets";
import { useShellStore } from "@/lib/store";
import { useOrbitStore } from "@/lib/store/orbit";
import type { ChipSpec, PayloadConfig } from "@/lib/types";

export interface CopilotState {
  altitudeKm: number;
  inclinationDeg: number;
  sunSynchronous: boolean;
  ltanHours: number | null;
  raanDeg: number;
  vehicle: Vehicle;
  presetId: string;
  spec: ChipSpec;
  payload: PayloadConfig;
  memoryUnit: "GB" | "KB";
  nodeKnown: boolean;
}

export function defaultCopilotState(): CopilotState {
  const preset = getPreset(DEFAULT_PRESET_ID);
  return {
    altitudeKm: DERIVED_SHELL.meanAltitudeKm,
    inclinationDeg: DERIVED_SHELL.meanInclinationDeg,
    sunSynchronous: false,
    ltanHours: null,
    raanDeg: 0,
    vehicle: {
      massKg: VEHICLE_MASS_KG,
      dragAreaM2: VEHICLE_DRAG_AREA_M2,
      cd: VEHICLE_CD,
      eolAltitudeKm: VEHICLE_EOL_KM,
    },
    presetId: preset.id,
    spec: preset.spec,
    payload: preset.payload,
    memoryUnit: preset.memoryUnit,
    nodeKnown: preset.nodeKnown,
  };
}

export function readCopilotState(): CopilotState {
  const orbit = useOrbitStore.getState();
  const shell = useShellStore.getState();
  const preset = getPreset(shell.presetId);
  return {
    altitudeKm: orbit.altitudeKm,
    inclinationDeg: orbit.inclinationDeg,
    sunSynchronous: orbit.sunSynchronous,
    ltanHours: orbit.ltanHours,
    raanDeg: orbit.raanDeg,
    vehicle: orbit.vehicle,
    presetId: shell.presetId,
    spec: shell.spec,
    payload: shell.payload,
    memoryUnit: preset.memoryUnit,
    nodeKnown: preset.nodeKnown,
  };
}

export function writeCopilotState(state: CopilotState): void {
  useOrbitStore.setState({
    altitudeKm: state.altitudeKm,
    inclinationDeg: state.inclinationDeg,
    sunSynchronous: state.sunSynchronous,
    ltanHours: state.ltanHours,
    raanDeg: state.raanDeg,
    vehicle: state.vehicle,
    preset: "custom",
  });
  useShellStore.setState({
    presetId: state.presetId,
    spec: state.spec,
    payload: state.payload,
  });
}
