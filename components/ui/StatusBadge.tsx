export type Status = "nominal" | "caution" | "critical";

const SHAPES: Record<Status, React.ReactNode> = {
  nominal: <circle cx="5" cy="5" r="4" fill="currentColor" />,
  caution: <path d="M5 1 9 9H1Z" fill="currentColor" />,
  critical: <rect x="1" y="1" width="8" height="8" fill="currentColor" />,
};

/** 3rok status: always a word plus a shape (circle, triangle, square). */
export function StatusBadge({ status, children }: { status: Status; children: React.ReactNode }) {
  return (
    <span className={`rok-badge rok-badge--${status} eyebrow`} data-status={status}>
      <svg viewBox="0 0 10 10" aria-hidden="true">
        {SHAPES[status]}
      </svg>
      {children}
    </span>
  );
}
