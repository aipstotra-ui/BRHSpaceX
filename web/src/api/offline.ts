import type { EarthConstants, EvalResult, MissionConfig } from "@3rok/cesium-plugin";
import { WGS84_EARTH } from "@3rok/cesium-plugin";

export interface OfflinePoint {
  config: {
    altitude_km: number;
    inclination: "sso" | number | string;
    ltan_hours: number;
    shield_mm_Al: number;
    solar_phase: number;
    chip_preset: string;
  };
  result: EvalResult & { error?: string };
}

export interface OfflineGrid {
  points: OfflinePoint[];
  disclaimer?: string;
}

export interface ChipSummary {
  id: string;
  vendor?: string | null;
  product?: string | null;
  category?: string | null;
  dose_limit_krad_Si?: number | null;
  dose_limit_provenance?: string | null;
}

export interface ParamsFile {
  earth?: {
    R_E_km: number;
    mu_km3_s2: number;
    J2: number;
    omega_earth_rad_s: number;
    year_days: number;
  };
  defaults?: Record<string, unknown>;
}

const RAD_HARD = new Set(["bae_rad750", "bae_rad5545"]);

export function chipPreset(config: MissionConfig): "commercial" | "rad_hard" {
  if (config.chip_preset === "rad_hard") return "rad_hard";
  if (config.chip_id && RAD_HARD.has(config.chip_id)) return "rad_hard";
  return "commercial";
}

export function earthFromParams(params: ParamsFile | null): EarthConstants {
  const earth = params?.earth;
  if (!earth) return WGS84_EARTH;
  return {
    radiusKm: earth.R_E_km,
    muKm3S2: earth.mu_km3_s2,
    j2: earth.J2,
    omegaEarthRadS: earth.omega_earth_rad_s,
    yearDays: earth.year_days,
  };
}

function inclinationKey(value: "sso" | number | string): "sso" | "30" {
  if (value === "sso" || value === "SSO") return "sso";
  return "30";
}

/** Nearest precomputed score. Fixed radiator area and load-follow-sun are not in the table. */
export function nearestOffline(
  grid: OfflineGrid | null,
  config: MissionConfig,
): { result: EvalResult | null; distance: number } {
  if (!grid?.points.length) return { result: null, distance: Number.POSITIVE_INFINITY };
  const preset = chipPreset(config);
  let best: OfflinePoint | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const point of grid.points) {
    if (!point.result || point.result.error || point.result.lifetime_years === undefined) continue;
    const cfg = point.config;
    const altitude = (cfg.altitude_km - config.altitude_km) / 1500;
    const ltan = (cfg.ltan_hours - config.ltan_hours) / 12;
    const shield = (cfg.shield_mm_Al - config.shield_mm_Al) / 14;
    const phase = (cfg.solar_phase ?? 1) - (config.solar_phase ?? 1);
    const inclination = inclinationKey(cfg.inclination) === inclinationKey(config.inclination) ? 0 : 1;
    const chip = cfg.chip_preset === preset ? 0 : 1;
    const score =
      altitude ** 2 + ltan ** 2 + shield ** 2 + phase ** 2 + inclination ** 2 + chip ** 2;
    if (score < bestScore) {
      bestScore = score;
      best = point;
    }
  }
  return { result: best?.result ?? null, distance: bestScore };
}

export function offlineIsApproximate(config: MissionConfig, distance: number): boolean {
  return (
    distance > 1e-6 ||
    config.radiator_area_m2 != null ||
    (config.load_strategy != null && config.load_strategy !== "constant")
  );
}
