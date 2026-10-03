export type SourceLabel = "source" | "estimate" | "UNVERIFIED";

export interface SourcedNumber {
  value: number;
  unit: string;
  label: SourceLabel;
  sourceUrl?: string;
}

export interface ChipSpec {
  vendor: string;
  name: string;
  nodeNm: number;
  acceleratorCount: number;
  cpuCount: number;
  memoryType: string;
  memoryCapacity: number;
  eccScheme: string;
  avgPowerKw: number;
  peakPowerKw: number;
  opTempMinC: number;
  opTempMaxC: number;
  shieldingMmAl: number;
  seuCrossSection?: number;
  tidLimitKradSi?: number;
  latchupLet?: number;
  dieArea?: number;
}

export interface PayloadConfig {
  radiatorAreaM2: number;
  radiatorSides: 1 | 2;
  tSinkK: number;
  emissivity: number;
}

export interface OrbitState {
  altitudeKm: SourcedNumber;
  inclinationDeg: SourcedNumber;
  ltan: string | null;
  sunSynchronous: boolean;
}

export interface WeatherState {
  kp: SourcedNumber | null;
  dst: SourcedNumber | null;
  bz: SourcedNumber | null;
  protonFlux: SourcedNumber | null;
  timeTag: string | null;
}

export interface ForecastQuantiles {
  P10: number;
  P50: number;
  P90: number;
}

export interface Forecast {
  target: string;
  horizon: string;
  quantiles: ForecastQuantiles;
  unit: string;
  label: SourceLabel;
  sourceUrl?: string;
}

export interface ChipImpact {
  upsetRate: SourcedNumber | null;
  annualDose: SourcedNumber | null;
  lifetimeTid: SourcedNumber | null;
  lifetimeDrag: SourcedNumber | null;
  eclipseFraction: SourcedNumber | null;
  thermalMargin: SourcedNumber | null;
  stormSensitivity: SourcedNumber | null;
}

export type ActionName = "continue" | "checkpoint" | "throttle" | "safe mode";

export interface ActionRecommendation {
  action: ActionName;
  confidence: SourcedNumber | null;
}

export interface OrbitRanking {
  rank: number;
  orbit: OrbitState;
  score: SourcedNumber;
}

export interface BacktestResult {
  name: string;
  cost: SourcedNumber | null;
  downtime: SourcedNumber | null;
  uncorrectableErrors: SourcedNumber | null;
}

export interface ValidationMetric {
  name: string;
  residual: SourcedNumber | null;
  percentError: SourcedNumber | null;
  skill: SourcedNumber | null;
  referenceUrl: string | null;
}
