import type { GlobeTheme } from "@3rok/cesium-plugin";

function color(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function readGlobeTheme(): GlobeTheme {
  return {
    background: color("--surface-100"),
    ink: color("--ink"),
    accent: color("--accent"),
    thermal: [
      color("--thermal-1"),
      color("--thermal-2"),
      color("--thermal-3"),
      color("--thermal-4"),
      color("--thermal-5"),
    ],
  };
}

export function readFont(variable: "--font-mono" | "--font-sans"): string {
  return color(variable);
}
