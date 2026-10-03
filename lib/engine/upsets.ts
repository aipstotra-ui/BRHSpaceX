import { marked, type Marked } from "@/lib/engine/marked";

/**
 * Continuous stand-in used by the engine. Girgis percents are case notes, not this formula.
 * General Kp/Dst/GOES multipliers are UNVERIFIED.
 */
export function estimatedStormMultiplier(kp: number): Marked {
  const extra = 0.05 * Math.max(0, kp - 2);
  return marked({
    value: 1 + extra,
    sigma: 0,
    unit: "1",
    isEstimate: true,
    label: "estimate",
    assumptions: [
      "Applied multiplier is 1 + 0.05 * max(0, Kp-2). The coefficient is an estimate.",
      "Girgis et al. 2023 Dst percents stay case references and are not substituted in.",
    ],
  });
}

export function rateFromBits(fluxPerCm2S: number, sigmaPerBit: number, bits: number, storm: number): number {
  return fluxPerCm2S * sigmaPerBit * bits * storm;
}

export function rateFromDevice(fluxPerCm2S: number, deviceCm2: number, storm: number): number {
  return fluxPerCm2S * deviceCm2 * storm;
}

export function splitEcc(scheme: string, rate: number): {
  correctable: Marked;
  due: Marked;
  sdc: Marked;
} {
  const known = /secded|error correction|single-bit/i.test(scheme);
  const correctableFrac = known ? 0.9 : 0.5;
  const correctable = rate * correctableFrac;
  const remainder = rate - correctable;
  const due = remainder * 0.8;
  const sdc = remainder - due;
  const fractionNote = known
    ? "0.9 of events are treated as correctable, and 0.8 of the rest as detected uncorrectable. Those fractions are estimates. The scheme name can still be sourced."
    : "The ECC scheme is unknown, so 0.5 of events are treated as correctable and 0.8 of the rest as detected uncorrectable. Those fractions are estimates. Unknown is not recorded as none.";
  const base = {
    sigma: 0,
    unit: "1/s",
    isEstimate: true,
    label: "estimate" as const,
    assumptions: [fractionNote],
  };
  return {
    correctable: marked({ ...base, value: correctable }),
    due: marked({ ...base, value: due }),
    sdc: marked({ ...base, value: sdc }),
  };
}
