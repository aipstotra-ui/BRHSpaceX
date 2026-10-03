import type { SourceLabel } from "@/lib/types";

export interface Marked {
  value: number;
  sigma: number;
  unit: string;
  isEstimate: boolean;
  label: SourceLabel;
  assumptions: string[];
  sourceUrl?: string;
}

export function marked(value: Marked): Marked {
  return value;
}
