/**
 * Long-range orbit choice uses this history summary.
 * It is climatology, not the short-term forecaster, and it is not forecast skill.
 *
 * Phase bands are an estimate: F10.7 under 80 sfu is low, 80–150 is mid, 150 and above is high.
 * Sunspot R (OMNI word 40) is not in the parsed hourly table.
 */
export const CLIMATOLOGY_SENTENCE =
  "Long-range orbit choice uses climatology (storm frequency by size across OMNI history and solar-cycle phase), not the short-term forecaster.";

export const PHASE_METHOD =
  "estimate: F10.7 < 80 low, 80–150 mid, >= 150 high. Sunspot R was not in the parsed OMNI table.";

export interface PhaseLevels {
  levels: Record<string, { blocks: number; hours: number }>;
  f107Count: number;
  f107Median: number | null;
}

export interface ClimatologyFile {
  years: number[];
  yearCount: number;
  phaseMethod: string;
  byPhase: Record<string, PhaseLevels>;
  sepEventTotal: number;
  notForecastSkill: true;
}
