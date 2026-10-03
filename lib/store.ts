import { create } from "zustand";

import { getPreset, DEFAULT_PRESET_ID } from "@/lib/presets";
import type { ChipSpec, PayloadConfig } from "@/lib/types";

export type PanelPhase = "loading" | "error" | "empty";

const initial = getPreset(DEFAULT_PRESET_ID);

type ShellState = {
  panelPhase: PanelPhase;
  setPanelPhase: (panelPhase: PanelPhase) => void;
  presetId: string;
  spec: ChipSpec;
  payload: PayloadConfig;
  setStudio: (next: { presetId: string; spec: ChipSpec; payload: PayloadConfig }) => void;
};

export const useShellStore = create<ShellState>((set) => ({
  panelPhase: "empty",
  setPanelPhase: (panelPhase) => set({ panelPhase }),
  presetId: initial.id,
  spec: initial.spec,
  payload: initial.payload,
  setStudio: (next) => set(next),
}));
