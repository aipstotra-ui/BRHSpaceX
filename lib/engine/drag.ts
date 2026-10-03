import { marked, type Marked } from "@/lib/engine/marked";

/** Flag only. M5 adds orbit-averaged drag and decay time. No altitude is used. */
export function dragFlag(): Marked {
  return marked({
    value: 0,
    sigma: 0,
    unit: "flag",
    isEstimate: true,
    label: "estimate",
    assumptions: [
      "Drag is flagged and not computed. Orbit-averaged drag and decay time are left for a later orbit model. No altitude is stated.",
    ],
  });
}
