import { create } from "zustand";

export type PanelPhase = "loading" | "error" | "empty";

type ShellState = {
  panelPhase: PanelPhase;
  setPanelPhase: (panelPhase: PanelPhase) => void;
};

export const useShellStore = create<ShellState>((set) => ({
  panelPhase: "empty",
  setPanelPhase: (panelPhase) => set({ panelPhase }),
}));
