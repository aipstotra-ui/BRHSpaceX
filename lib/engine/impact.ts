import type { ChipSpec, PayloadConfig, SourceLabel } from "@/lib/types";

import { memoryBits, memoryGigabytes, estimatedPerBitSigma, resolveDieArea, resolveLatchup, resolveTid } from "@/lib/engine/chipModel";
import { annualDose, fiveYearDose, lifetimeYears } from "@/lib/engine/dose";
import { dragFlag } from "@/lib/engine/drag";
import type { Marked } from "@/lib/engine/marked";
import { marked } from "@/lib/engine/marked";
import { sweepUnknown, type SweepBand } from "@/lib/engine/montecarlo";
import { directionalQuietFlux, omnidirectionalQuietFlux } from "@/lib/engine/radiation";
import { assessThermal, type ThermalReport } from "@/lib/engine/thermal";
import { estimatedStormMultiplier, rateFromBits, rateFromDevice, splitEcc } from "@/lib/engine/upsets";

export const SNAPSHOT_KP = 2;

export interface DeviceSeu {
  cm2: number;
  sourceUrl: string;
  note: string;
}

export interface ImpactRequest {
  spec: ChipSpec;
  payload: PayloadConfig;
  kp: number;
  memoryUnit?: "GB" | "KB";
  nodeKnown?: boolean;
  deviceSeu?: DeviceSeu;
  ratioLabel?: SourceLabel;
}

export interface ImpactResult {
  directionalFlux: Marked;
  omnidirectionalFlux: Marked;
  storm: Marked;
  bits: Marked;
  crossSection: Marked;
  upsetRate: Marked;
  correctable: Marked;
  due: Marked;
  sdc: Marked;
  fiveYearDose: Marked;
  annualDose: Marked;
  tidLimit: Marked;
  lifetimeYears: Marked;
  latchupLet: Marked;
  dieAreaCm2: Marked;
  drag: Marked;
  thermal: ThermalReport;
  monteCarlo: SweepBand;
}

export function simulateImpact(request: ImpactRequest): ImpactResult {
  const unit = request.memoryUnit ?? "GB";
  const nodeKnown = request.nodeKnown ?? request.spec.nodeNm > 0;
  const flux = omnidirectionalQuietFlux();
  const storm = estimatedStormMultiplier(request.kp);
  const bits = memoryBits(request.spec.memoryCapacity, unit);
  const tid = resolveTid(request.spec);
  const latchup = resolveLatchup(request.spec);
  const die = resolveDieArea(request.spec, memoryGigabytes(request.spec.memoryCapacity, unit));
  const annual = annualDose();
  const life = lifetimeYears(tid.value, tid.isEstimate);

  let crossSection: Marked;
  let upset: number;
  if (request.deviceSeu) {
    crossSection = marked({
      value: request.deviceSeu.cm2,
      sigma: 0,
      unit: "cm2",
      isEstimate: false,
      label: "source",
      sourceUrl: request.deviceSeu.sourceUrl,
      assumptions: [request.deviceSeu.note, "Device cross-section is not multiplied by a bit count."],
    });
    upset = rateFromDevice(flux.value, request.deviceSeu.cm2, storm.value);
  } else if (request.spec.seuCrossSection !== undefined) {
    crossSection = marked({
      value: request.spec.seuCrossSection,
      sigma: 0,
      unit: "cm2/bit",
      isEstimate: false,
      label: "UNVERIFIED",
      assumptions: ["Per-bit cross-section was present on the chip spec."],
    });
    upset = rateFromBits(flux.value, request.spec.seuCrossSection, bits.value, storm.value);
  } else {
    crossSection = estimatedPerBitSigma(request.spec.nodeNm, nodeKnown);
    upset = rateFromBits(flux.value, crossSection.value, bits.value, storm.value);
  }

  const ecc = splitEcc(request.spec.eccScheme, upset);
  const upsetRate = marked({
    value: upset,
    sigma: crossSection.isEstimate ? Math.abs(upset) * (crossSection.value === 0 ? 0 : crossSection.sigma / Math.abs(crossSection.value)) : 0,
    unit: "1/s",
    isEstimate: true,
    label: "estimate",
    assumptions: [
      "Upset rate multiplies the omnidirectional flux estimate, the cross-section, the bit count or device area, and the Kp multiplier estimate.",
      ...crossSection.assumptions,
    ],
  });

  const swept = sweepUnknown({
    upsetPerS: upset,
    crossSection: {
      value: crossSection.value,
      sigma: crossSection.sigma,
      estimated: crossSection.isEstimate,
    },
    tidKrad: { value: tid.value, sigma: tid.sigma, estimated: tid.isEstimate },
    dieCm2: { value: die.value, sigma: die.sigma, estimated: die.isEstimate },
    latchup: { value: latchup.value, sigma: latchup.sigma, estimated: latchup.isEstimate },
    annualKrad: annual.value,
  });

  return {
    directionalFlux: directionalQuietFlux(),
    omnidirectionalFlux: flux,
    storm,
    bits,
    crossSection,
    upsetRate,
    correctable: ecc.correctable,
    due: ecc.due,
    sdc: ecc.sdc,
    fiveYearDose: fiveYearDose(),
    annualDose: annual,
    tidLimit: tid,
    lifetimeYears: life,
    latchupLet: latchup,
    dieAreaCm2: die,
    drag: dragFlag(),
    thermal: assessThermal(
      request.spec.avgPowerKw,
      request.spec.peakPowerKw,
      request.payload,
      request.ratioLabel ?? "estimate",
    ),
    monteCarlo: swept,
  };
}
