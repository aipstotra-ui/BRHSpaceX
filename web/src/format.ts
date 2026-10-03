export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 100) return value.toFixed(0);
  if (abs >= 10) return value.toFixed(Math.min(1, digits));
  return value.toFixed(digits);
}

export function formatSci(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value !== 0 && (Math.abs(value) < 0.01 || Math.abs(value) >= 1_000_000)) {
    return value.toExponential(2);
  }
  return formatNumber(value, 2);
}

const MODES: Record<string, string> = {
  tid: "TID",
  thermal_fatigue: "Thermal",
  power: "Power",
  seu_availability: "SEU",
  radiator_capacity: "Radiator",
  none_infinite: "None",
};

export function modeLabel(mode: string | undefined): string {
  if (!mode) return "—";
  return MODES[mode] ?? mode;
}
