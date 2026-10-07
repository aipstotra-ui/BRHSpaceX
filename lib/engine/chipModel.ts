import type { ChipSpec } from "@/lib/types";

import { marked, type Marked } from "@/lib/engine/marked";

/**
 * Estimate: per-bit raw proton upset cross-section for SRAM-class memory. Published 65 nm SRAM values span about
 * 0.4e-14 to 2.7e-14 cm2/bit. Not used for DRAM (see DRAM_UNCORRECTABLE_CM2_PER_BIT) and not taken from the Orin
 * device cross-section.
 */
export const PER_BIT_CM2_AT_28NM = 1e-14;

export const REFERENCE_NODE_NM = 28;

/**
 * What the upset rate counts. "raw": every bit flip, before ECC (SRAM-class anchor or a measured device
 * cross-section). "uncorrectable": DRAM errors that ECC detected but could not correct, the only DRAM quantity
 * with a measurement here.
 */
export type UpsetKind = "raw" | "uncorrectable";

export function isDram(memoryType: string): boolean {
  return /HBM|LPDDR|GDDR|DDR|DRAM/i.test(memoryType);
}

export const SUNCATCHER_PAPER_URL = "https://arxiv.org/abs/2511.19468";

/**
 * Google Suncatcher (arXiv 2511.19468): TPU v6e HBM under 67 MeV protons showed about one uncorrectable ECC error
 * per 50 rad(Si) (secondary reports give 44 to 50 rad), on 32 GB of HBM.
 */
export const HBM_RAD_PER_UNCORRECTABLE = 50;
export const HBM_TEST_BITS = 32e9 * 8;

/** Stopping power of 67 MeV protons in silicon, MeV cm2/g. Bethe formula (I = 173 eV); NIST PSTAR agrees within ~1%. */
export const PROTON_67MEV_SI_MEV_CM2_G = 7.89;

/** 1 MeV/g = 1.602176634e-8 rad. */
const RAD_PER_MEV_PER_G = 1.602176634e-8;

/**
 * Uncorrectable-error cross-section per DRAM bit: fluence per rad at 67 MeV, times 50 rad per event, inverted and
 * divided by the tested bits. About 9.9e-21 cm2/bit (2.5e-9 cm2 per 32 GB chip).
 */
export const DRAM_UNCORRECTABLE_CM2_PER_BIT =
  (RAD_PER_MEV_PER_G * PROTON_67MEV_SI_MEV_CM2_G) / HBM_RAD_PER_UNCORRECTABLE / HBM_TEST_BITS;

export function dramUncorrectableSigma(): Marked {
  const value = DRAM_UNCORRECTABLE_CM2_PER_BIT;
  return marked({
    value,
    sigma: value,
    unit: "cm2/bit",
    isEstimate: true,
    label: "estimate",
    sourceUrl: SUNCATCHER_PAPER_URL,
    assumptions: [
      "Google measured about one uncorrectable ECC error per 50 rad(Si) on TPU v6e HBM (32 GB) with 67 MeV protons (Suncatcher, arXiv 2511.19468).",
      "Converted with 7.89 MeV cm2/g (67 MeV protons in Si) to 2.5e-9 cm2 per chip, 9.9e-21 cm2/bit. The conversion and the per-bit scaling are estimates.",
      "Applies to ECC-protected DRAM like the tested HBM. Other HBM generations, LPDDR, and ECC schemes are not measured; without ECC every raw upset would be an error.",
      "Raw upsets that ECC corrects are not estimated for DRAM: no public per-bit proton cross-section for HBM or LPDDR was available.",
    ],
  });
}

/** Estimate used only when the spec has no TID limit. */
export const MISSING_TID_KRAD = 10;

/** Estimate: cm² of die per GB, with uncertainty equal to the value. */
export const DIE_CM2_PER_GB = 0.5;

export function memoryBits(capacity: number, unit: "GB" | "KB"): Marked {
  if (unit === "KB") {
    return marked({
      value: capacity * 1000 * 8,
      sigma: 0,
      unit: "bit",
      isEstimate: true,
      label: "estimate",
      assumptions: [
        "Bit count uses a decimal kilobyte (1000 bytes) and does not add other on-chip memories.",
      ],
    });
  }
  return marked({
    value: capacity * 1e9 * 8,
    sigma: 0,
    unit: "bit",
    isEstimate: true,
    label: "estimate",
    assumptions: ["Bit count uses a decimal gigabyte (1e9 bytes)."],
  });
}

export function estimatedPerBitSigma(nodeNm: number, nodeKnown: boolean): Marked {
  const known = nodeKnown && nodeNm > 0;
  const usedNm = known ? nodeNm : REFERENCE_NODE_NM;
  const value = PER_BIT_CM2_AT_28NM * (usedNm / REFERENCE_NODE_NM);
  const widened = !known;
  return marked({
    value,
    sigma: widened ? value : value * 0.5,
    unit: "cm2/bit",
    isEstimate: true,
    label: "estimate",
    assumptions: [
      known
        ? "Per-bit raw upset cross-section is estimated as 1e-14 cm2/bit at 28 nm (SRAM-class), linear in the stated node."
        : "Process node is unverified. The per-bit raw upset cross-section uses a 28 nm SRAM-class reference with widened uncertainty. A node of 0 nm is not a measurement.",
    ],
  });
}

export function resolveTid(spec: ChipSpec): Marked {
  if (spec.tidLimitKradSi !== undefined) {
    return marked({
      value: spec.tidLimitKradSi,
      sigma: 0,
      unit: "krad(Si)",
      isEstimate: false,
      label: "UNVERIFIED",
      assumptions: ["TID limit was present on the chip spec. The preset badge carries the source when one exists."],
    });
  }
  return marked({
    value: MISSING_TID_KRAD,
    sigma: MISSING_TID_KRAD,
    unit: "krad(Si)",
    isEstimate: true,
    label: "estimate",
    assumptions: ["No TID limit on the spec. 10 krad(Si) is an estimate with uncertainty equal to that estimate."],
  });
}

export function resolveLatchup(spec: ChipSpec): Marked {
  if (spec.latchupLet !== undefined) {
    return marked({
      value: spec.latchupLet,
      sigma: 0,
      unit: "MeV.cm2/mg",
      isEstimate: false,
      label: "UNVERIFIED",
      assumptions: ["Latch-up LET was present on the chip spec. The preset badge carries the source when one exists."],
    });
  }
  return marked({
    value: 0,
    sigma: 0,
    unit: "MeV.cm2/mg",
    isEstimate: true,
    label: "UNVERIFIED",
    assumptions: ["No latch-up LET was published for this part. 0 is not a measurement and is not a threshold."],
  });
}

export function resolveDieArea(spec: ChipSpec, memoryGb: number): Marked {
  if (spec.dieArea !== undefined) {
    return marked({
      value: spec.dieArea,
      sigma: 0,
      unit: "cm2",
      isEstimate: false,
      label: "UNVERIFIED",
      assumptions: ["Die area was present on the chip spec."],
    });
  }
  const value = memoryGb * DIE_CM2_PER_GB;
  return marked({
    value,
    sigma: Math.abs(value),
    unit: "cm2",
    isEstimate: true,
    label: "estimate",
    assumptions: [
      "Die area is estimated as 0.5 cm2 per GB of memory, with uncertainty equal to the estimate. Not a published die size.",
    ],
  });
}

export function memoryGigabytes(capacity: number, unit: "GB" | "KB"): number {
  if (unit === "KB") {
    return (capacity * 1000) / 1e9;
  }
  return capacity;
}
