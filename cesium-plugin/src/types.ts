/**
 * JSON contract between a host app and a physics service.
 *
 * The plugin does not fetch and does not import a physics package.
 * A host implements {@link PhysicsClient} (HTTP, a fixture, a test double)
 * and passes results into {@link Globe} or {@link useEngineData}.
 *
 * Shapes match a ranking evaluation: one configuration in, one derived
 * result out, plus a trapped-flux grid and a Pareto set. Units are in the
 * field names. `null` means non-finite (for example no eclipse wear).
 */

export interface MissionConfig {
  altitude_km: number;
  /** "sso" or an inclination in degrees. */
  inclination: "sso" | number;
  ltan_hours: number;
  shield_mm_Al: number;
  /** Null asks the service to size the radiator. */
  radiator_area_m2: number | null;
  chip_id?: string | null;
  chip_preset?: string;
  /** 0 = solar min, 1 = solar max. Omit to use the service default. */
  solar_phase?: number;
  load_strategy?: "constant" | "load_follow_sun";
  n_samples?: number;
}

export interface OrbitReading {
  altitude_km: number;
  inclination_deg: number;
  ltan_hours: number;
  period_min: number;
  beta_deg: number;
  eclipse_fraction: number;
  sunlight_fraction: number;
}

export interface DoseReading {
  dose_rate_krad_Si_per_year: number;
  dose_limit_krad_Si?: number;
  dose_limit_provenance?: string | null;
  chip_id?: string | null;
  chip_product?: string | null;
  chip_preset?: string | null;
}

export interface SeuReading {
  seu_rate_per_bit_day?: number;
  seu_events_per_day: number;
  availability: number;
  downtime_fraction?: number;
}

export interface ThermalReading {
  delta_T_K: number | null;
  cycles_per_year: number | null;
  lifetime_thermal_years: number | null;
  N_f_cycles?: number | null;
}

export interface PowerReading {
  bol_sunlit_kW?: number | null;
  mean_power_before_seu_kW?: number | null;
  degradation_at_eval?: number | null;
  lifetime_power_years?: number | null;
}

export interface Breakdown {
  L_tid_years: number | null;
  L_thermal_years: number | null;
  L_power_years: number | null;
  L_seu_availability_years: number | null;
}

export interface EvalResult {
  lifetime_years: number | null;
  mean_power_kW: number | null;
  radiator_area_m2: number | null;
  shield_mass_kg: number | null;
  limiting_mode: string;
  /** Service label. Physics numbers are derived estimates, not measurements. */
  value_status?: string;
  assumptions_note?: string;
  orbit?: OrbitReading;
  dose?: DoseReading;
  seu?: SeuReading;
  thermal?: ThermalReading;
  power?: PowerReading;
  breakdown?: Breakdown;
  cooling?: {
    heat_load_kW?: number | null;
    radiator_sized_from_stefan_boltzmann?: boolean;
  };
  chip?: {
    id?: string;
    vendor?: string | null;
    product?: string | null;
    dose_limit_provenance?: string | null;
  } | null;
}

export interface FluxGrid {
  altitude_km?: number;
  particle?: string;
  energy_MeV?: number;
  solar?: string;
  lat_deg: number[];
  lon_deg: number[];
  /** Rows follow lat_deg, columns follow lon_deg. Null is an empty model cell. */
  flux_cm2_s: (number | null)[][];
  flux_cm2_s_max?: number | null;
}

export interface SaaGridQuery {
  altitude_km?: number;
  particle?: "p" | "e";
  solar?: "min" | "max";
  lat_step?: number;
  lon_step?: number;
}

export interface ParetoPoint {
  id?: string;
  config: {
    altitude_km: number;
    inclination: "sso" | number | string;
    ltan_hours: number;
    shield_mm_Al: number;
    chip_preset?: string;
    load_strategy?: string;
  };
  lifetime_years: number | null;
  mean_power_kW: number | null;
  shielding_cost?: number | null;
  shield_mass_kg?: number | null;
  radiator_area_m2?: number | null;
  limiting_mode?: string;
}

export interface ParetoPayload {
  pareto_front: ParetoPoint[];
  evaluated?: ParetoPoint[];
  disclaimer?: string;
  n_evaluated?: number;
  method?: string;
}

/** Sampled ground track or OEM ephemeris, already in geodetic degrees and km. */
export interface Track {
  lat_deg: number[];
  lon_deg: number[];
  /** Scalar altitude, or one height per sample (OEM). */
  alt_km: number | number[];
  /** Seconds since epoch_utc. */
  times_s: number[];
  epoch_utc?: string | null;
  source?: string;
}

export interface OemEvaluation {
  result: EvalResult;
  track: Track;
  disclaimer?: string;
}

/**
 * Host-supplied access to a physics service.
 * `track` and `evaluateOem` are optional; the globe can draw a track the host built itself.
 */
export interface PhysicsClient {
  evaluate(config: MissionConfig, signal?: AbortSignal): Promise<EvalResult>;
  optimize(signal?: AbortSignal): Promise<ParetoPayload>;
  saaGrid(query?: SaaGridQuery, signal?: AbortSignal): Promise<FluxGrid>;
  track?(
    config: Pick<MissionConfig, "altitude_km" | "inclination">,
    signal?: AbortSignal,
  ): Promise<Track>;
  evaluateOem?(
    file: Blob,
    config: MissionConfig,
    signal?: AbortSignal,
  ): Promise<OemEvaluation>;
}

/** Colors the host resolves from its own design tokens. */
export interface GlobeTheme {
  background: string;
  ink: string;
  accent: string;
  /** Cool (long life / low flux) through hot (short life / high flux). */
  thermal: [string, string, string, string, string];
}

export type ImageryMode = "ion" | "natural-earth" | "ellipsoid";

export interface EarthConstants {
  radiusKm: number;
  muKm3S2: number;
  omegaEarthRadS: number;
  j2: number;
  yearDays: number;
}
