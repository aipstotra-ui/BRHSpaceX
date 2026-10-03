export interface SweepInput {
  upsetPerS: number;
  crossSection: { value: number; sigma: number; estimated: boolean };
  tidKrad: { value: number; sigma: number; estimated: boolean };
  dieCm2: { value: number; sigma: number; estimated: boolean };
  latchup: { value: number; sigma: number; estimated: boolean };
  annualKrad: number;
}

export interface SweepBand {
  upsetLow: number;
  upsetHigh: number;
  lifetimeLow: number;
  lifetimeHigh: number;
  dieLow: number;
  dieHigh: number;
  latchupLow: number;
  latchupHigh: number;
  isEstimate: boolean;
  assumptions: string[];
}

function endpoints(value: number, sigma: number, estimated: boolean): [number, number] {
  if (!estimated) {
    return [value, value];
  }
  return [value - sigma, value + sigma];
}

/** Deterministic ±σ endpoints of unknown chip parameters. Flux conversion and the storm multiplier are not swept. */
export function sweepUnknown(input: SweepInput): SweepBand {
  const [sigmaLow, sigmaHigh] = endpoints(
    input.crossSection.value,
    input.crossSection.sigma,
    input.crossSection.estimated,
  );
  const scale = input.crossSection.value === 0 ? 1 : 1 / input.crossSection.value;
  const upsetLow = input.crossSection.estimated ? input.upsetPerS * sigmaLow * scale : input.upsetPerS;
  const upsetHigh = input.crossSection.estimated ? input.upsetPerS * sigmaHigh * scale : input.upsetPerS;
  const [tidLow, tidHigh] = endpoints(input.tidKrad.value, input.tidKrad.sigma, input.tidKrad.estimated);
  const annual = input.annualKrad > 0 ? input.annualKrad : 1;
  const [dieLow, dieHigh] = endpoints(input.dieCm2.value, input.dieCm2.sigma, input.dieCm2.estimated);
  const [latchLow, latchHigh] = endpoints(input.latchup.value, input.latchup.sigma, input.latchup.estimated);
  const swept =
    input.crossSection.estimated || input.tidKrad.estimated || input.dieCm2.estimated || input.latchup.estimated;
  return {
    upsetLow: Math.min(upsetLow, upsetHigh),
    upsetHigh: Math.max(upsetLow, upsetHigh),
    lifetimeLow: Math.min(tidLow, tidHigh) / annual,
    lifetimeHigh: Math.max(tidLow, tidHigh) / annual,
    dieLow: Math.min(dieLow, dieHigh),
    dieHigh: Math.max(dieLow, dieHigh),
    latchupLow: Math.min(latchLow, latchHigh),
    latchupHigh: Math.max(latchLow, latchHigh),
    isEstimate: swept,
    assumptions: [
      "The band is the ±σ endpoints of unknown chip parameters only. The 4π flux conversion and the Kp multiplier are estimates and are not swept.",
    ],
  };
}
