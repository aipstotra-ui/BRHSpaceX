import type { ReactNode } from "react";

import "@/components/ui/disclosure.css";
import { SourceBadge } from "@/components/ui/SourceBadge";
import type { SourceLabel } from "@/lib/types";

/**
 * Detail that stays closed until asked for. The title says what is inside; `meta` says enough to
 * decide whether to open it (a count, a status), and stays visible while it is closed.
 */
export function Disclosure({
  title,
  meta,
  defaultOpen = false,
  className,
  children,
}: {
  title: string;
  meta?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details className={className ? `disclosure ${className}` : "disclosure"} open={defaultOpen}>
      <summary className="eyebrow">
        {title}
        {meta ? <span className="disclosure__meta">{meta}</span> : null}
      </summary>
      <div className="disclosure__body">{children}</div>
    </details>
  );
}

const ORDER: SourceLabel[] = ["source", "estimate", "UNVERIFIED"];

/**
 * How many hidden fields are sourced, estimated or unverified. A closed section must not hide an
 * UNVERIFIED value, so its header carries these counts, each with the same badge the field has.
 */
export function FieldCounts({ labels }: { labels: SourceLabel[] }) {
  return (
    <span className="field-counts body-sm">
      <span>{labels.length} fields</span>
      {ORDER.map((label) => {
        const count = labels.filter((item) => item === label).length;
        if (count === 0) {
          return null;
        }
        // Source and estimate badges are hidden on screen, so their counts stay in the DOM but are not shown.
        return label === "UNVERIFIED" ? (
          <span className="field-counts__item" key={label}>
            <SourceBadge label={label} /> {count}
          </span>
        ) : (
          <span className="field-counts__item" key={label} hidden>
            <SourceBadge label={label} /> {count}
          </span>
        );
      })}
    </span>
  );
}
