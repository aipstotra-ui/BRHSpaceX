import type { SourceLabel } from "@/lib/types";

export function SourceBadge({ label }: { label: SourceLabel }) {
  return (
    <span className="rok-badge body-sm" data-source-label={label}>
      {label}
    </span>
  );
}
