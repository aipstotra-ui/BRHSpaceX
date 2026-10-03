import { marked, type Marked } from "@/lib/engine/marked";

export const GOOGLE_DOSE_URL =
  "https://research.google/blog/exploring-a-space-based-scalable-ai-infrastructure-system-design/";

/** Shielded 5-year LEO anchor from the Google Suncatcher blog. 750 rad(Si) = 0.75 krad(Si). */
export const SHIELDED_FIVE_YEAR_RAD = 750;

export function fiveYearDose(): Marked {
  return marked({
    value: SHIELDED_FIVE_YEAR_RAD,
    sigma: 0,
    unit: "rad(Si)/5yr",
    isEstimate: false,
    label: "source",
    sourceUrl: GOOGLE_DOSE_URL,
    assumptions: [
      "Google Suncatcher shielded 5-year LEO dose. Applying it to a chip with no orbit is not this number; see the annual figure.",
    ],
  });
}

export function annualDose(): Marked {
  const value = SHIELDED_FIVE_YEAR_RAD / 1000 / 5;
  return marked({
    value,
    sigma: value,
    unit: "krad(Si)/yr",
    isEstimate: true,
    label: "estimate",
    sourceUrl: GOOGLE_DOSE_URL,
    assumptions: [
      "0.15 krad(Si)/yr divides the sourced 750 rad(Si) by five years. No orbit and no shielding-thickness curve are applied, so this use is an estimate.",
    ],
  });
}

export function lifetimeYears(tidKrad: number, tidIsEstimate: boolean): Marked {
  const annual = annualDose().value;
  const value = annual > 0 ? tidKrad / annual : 0;
  return marked({
    value,
    sigma: tidIsEstimate ? Math.abs(value) : 0,
    unit: "yr",
    isEstimate: true,
    label: "estimate",
    assumptions: [
      "Lifetime is the TID limit divided by the annual dose estimate. The dose anchor has no orbit, so lifetime stays an estimate even when the TID limit is sourced.",
    ],
  });
}
