import { create } from "zustand";

import { getPreset, DEFAULT_PRESET_ID } from "@/lib/presets";
import type { ChipSpec, PayloadConfig } from "@/lib/types";

const initial = getPreset(DEFAULT_PRESET_ID);

type ShellState = {
  presetId: string;
  spec: ChipSpec;
  payload: PayloadConfig;
  setStudio: (next: { presetId: string; spec: ChipSpec; payload: PayloadConfig }) => void;
};

export const useShellStore = create<ShellState>((set) => ({
  presetId: initial.id,
  spec: initial.spec,
  payload: initial.payload,
  setStudio: (next) => set(next),
}));
