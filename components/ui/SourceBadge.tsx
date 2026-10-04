import type { SourceLabel } from "@/lib/types";

/**
 * Provenance for a displayed number. "source" and "estimate" stay in the DOM as a hidden marker
 * (data-source-label) so the label is still inspectable and testable, but they are not shown.
 * "UNVERIFIED" is a warning and stays visible.
 */
export function SourceBadge({ label }: { label: SourceLabel }) {
  if (label !== "UNVERIFIED") {
    return <span data-source-label={label} hidden />;
  }
  return (
    <span className="rok-badge body-sm" data-source-label={label}>
      {label}
    </span>
  );
}
