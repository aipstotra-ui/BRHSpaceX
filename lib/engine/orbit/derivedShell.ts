import type { ShellCluster } from "@/lib/engine/orbit/shellCluster";

/**
 * Locked output of largestShell on data/snapshots/celestrak_gp.json.
 * Grouping rules are estimates. This mean is not an AI1 altitude.
 */
export const DERIVED_SHELL: ShellCluster = {
  count: 3383,
  meanAltitudeKm: 462.5739441337271,
  meanInclinationDeg: 53.15968545669517,
  inclinationBinDeg: 53.2,
  altitudeMinKm: 459,
  altitudeMaxKm: 465,
};
