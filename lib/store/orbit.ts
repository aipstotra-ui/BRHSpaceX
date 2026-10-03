import { create } from "zustand";

import {
  VEHICLE_CD,
  VEHICLE_DRAG_AREA_M2,
  VEHICLE_EOL_KM,
  VEHICLE_MASS_KG,
} from "@/lib/engine/orbit/constants";
import { DERIVED_SHELL } from "@/lib/engine/orbit/derivedShell";
import type { Vehicle } from "@/lib/engine/orbit/lifetime";
import { ssoInclinationDeg } from "@/lib/engine/orbit/sso";

export type OrbitPreset = "initial" | "sso-dawn" | "sso-noon" | "starlink-shell" | "custom";

export interface OrbitLocationState {
  altitudeKm: number;
  inclinationDeg: number;
  sunSynchronous: boolean;
  ltanHours: number | null;
  raanDeg: number;
  preset: OrbitPreset;
  vehicle: Vehicle;
  setAltitudeKm: (altitudeKm: number) => void;
  setInclinationDeg: (inclinationDeg: number) => void;
  setLtanHours: (ltanHours: number) => void;
  setSunSynchronous: (sunSynchronous: boolean) => void;
  setVehicle: (vehicle: Vehicle) => void;
  applyPreset: (preset: OrbitPreset) => void;
}

function shellState(preset: "initial" | "starlink-shell"): Pick<
  OrbitLocationState,
  "altitudeKm" | "inclinationDeg" | "sunSynchronous" | "ltanHours" | "raanDeg" | "preset"
> {
  return {
    altitudeKm: DERIVED_SHELL.meanAltitudeKm,
    inclinationDeg: DERIVED_SHELL.meanInclinationDeg,
    sunSynchronous: false,
    ltanHours: null,
    raanDeg: 0,
    preset,
  };
}

function ssoState(preset: "sso-dawn" | "sso-noon", ltanHours: number) {
  return {
    altitudeKm: DERIVED_SHELL.meanAltitudeKm,
    inclinationDeg: ssoInclinationDeg(DERIVED_SHELL.meanAltitudeKm),
    sunSynchronous: true,
    ltanHours,
    raanDeg: 0,
    preset,
  };
}

const initialVehicle: Vehicle = {
  massKg: VEHICLE_MASS_KG,
  dragAreaM2: VEHICLE_DRAG_AREA_M2,
  cd: VEHICLE_CD,
  eolAltitudeKm: VEHICLE_EOL_KM,
};

export const useOrbitStore = create<OrbitLocationState>((set, get) => ({
  ...shellState("initial"),
  vehicle: initialVehicle,
  setAltitudeKm: (altitudeKm) => {
    const sunSynchronous = get().sunSynchronous;
    set({
      altitudeKm,
      inclinationDeg: sunSynchronous ? ssoInclinationDeg(altitudeKm) : get().inclinationDeg,
      preset: "custom",
    });
  },
  setInclinationDeg: (inclinationDeg) => set({ inclinationDeg, preset: "custom" }),
  setLtanHours: (ltanHours) => set({ ltanHours, preset: "custom" }),
  setSunSynchronous: (sunSynchronous) => {
    if (sunSynchronous) {
      const altitudeKm = get().altitudeKm;
      set({
        sunSynchronous: true,
        inclinationDeg: ssoInclinationDeg(altitudeKm),
        ltanHours: get().ltanHours ?? 6,
        preset: "custom",
      });
      return;
    }
    set({ sunSynchronous: false, ltanHours: null, raanDeg: 0, preset: "custom" });
  },
  setVehicle: (vehicle) => set({ vehicle }),
  applyPreset: (preset) => {
    if (preset === "sso-dawn") {
      set(ssoState("sso-dawn", 6));
      return;
    }
    if (preset === "sso-noon") {
      set(ssoState("sso-noon", 12));
      return;
    }
    if (preset === "starlink-shell") {
      set(shellState("starlink-shell"));
      return;
    }
    set(shellState("initial"));
  },
}));
