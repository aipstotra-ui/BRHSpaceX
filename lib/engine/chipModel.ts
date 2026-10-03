import type { ChipSpec } from "@/lib/types";

import { marked, type Marked } from "@/lib/engine/marked";

/** Estimate: per-bit proton cross-section anchor. Not taken from the Orin device cross-section. */
export const PER_BIT_CM2_AT_28NM = 1e-14;

export const REFERENCE_NODE_NM = 28;

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
        ? "Per-bit cross-section is estimated as 1e-14 cm2/bit at 28 nm, linear in the stated node."
        : "Process node is unverified. The per-bit cross-section uses a 28 nm reference with widened uncertainty. A node of 0 nm is not a measurement.",
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
