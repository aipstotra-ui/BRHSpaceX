import type { ButtonHTMLAttributes, ReactNode } from "react";

type Status = "nominal" | "caution" | "critical";

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function Arrow() {
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 7h12M8 2l5 5-5 5" />
    </svg>
  );
}

export function Button({
  variant = "ghost",
  size,
  href,
  arrow,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "ghost" | "quiet";
  size?: "sm";
  href?: string;
  arrow?: boolean;
}) {
  const classNames = cx(
    "rok-btn",
    "button",
    variant === "solid" && "rok-btn--solid",
    variant === "quiet" && "rok-btn--quiet",
    size === "sm" && "rok-btn--sm",
    className,
  );
  const content = (
    <>
      {children}
      {(arrow || variant === "quiet") && <Arrow />}
    </>
  );
  if (href) {
    return (
      <a className={classNames} href={href}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" className={classNames} {...rest}>
      {content}
    </button>
  );
}

export function NavBar({
  brand = "3rok",
  links,
  active,
  action,
}: {
  brand?: string;
  links: { label: string; href?: string }[];
  active?: string;
  action?: ReactNode;
}) {
  return (
    <header className="rok-nav">
      <a className="rok-nav__mark" href="#top">
        {brand}
      </a>
      <nav aria-label="Primary">
        <ul className="rok-nav__links">
          {links.map((link) => (
            <li key={link.label}>
              <a
                className="rok-nav__link eyebrow"
                href={link.href || "#top"}
                aria-current={link.label === active ? "page" : undefined}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {action}
    </header>
  );
}

export function Panel({
  eyebrow,
  title,
  children,
  className,
  id,
}: {
  eyebrow?: string;
  title?: string;
  children?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cx("rok-panel", className)}>
      {eyebrow ? <p className="rok-panel__eyebrow eyebrow">{eyebrow}</p> : null}
      {title ? <h2 className="rok-panel__title heading-md">{title}</h2> : null}
      {children}
    </section>
  );
}

const SHAPES: Record<Status, ReactNode> = {
  nominal: (
    <svg viewBox="0 0 10 10" aria-hidden="true">
      <circle cx="5" cy="5" r="5" fill="currentColor" />
    </svg>
  ),
  caution: (
    <svg viewBox="0 0 10 10" aria-hidden="true">
      <path d="M5 0l5 10H0z" fill="currentColor" />
    </svg>
  ),
  critical: (
    <svg viewBox="0 0 10 10" aria-hidden="true">
      <rect width="10" height="10" fill="currentColor" />
    </svg>
  ),
};

const WORDS: Record<Status, string> = {
  nominal: "Nominal",
  caution: "Caution",
  critical: "Critical",
};

export function StatusBadge({
  status = "nominal",
  children,
}: {
  status?: Status;
  children?: ReactNode;
}) {
  return (
    <span className={cx("rok-badge", `rok-badge--${status}`, "eyebrow")}>
      {SHAPES[status]}
      {children || WORDS[status]}
    </span>
  );
}

export function Stat({
  label,
  value,
  unit,
  status,
  compact,
}: {
  label: string;
  value: string | number;
  unit?: string;
  status?: Status;
  compact?: boolean;
}) {
  return (
    <div className="rok-stat">
      <p className="rok-stat__label eyebrow">{label}</p>
      <div className="rok-stat__row">
        <span className={cx("rok-stat__value", compact ? "data-md" : "data-xl")}>{value}</span>
        {unit ? <span className="rok-stat__unit data-sm">{unit}</span> : null}
      </div>
      {status ? (
        <div className="rok-stat__meta data-sm">
          <StatusBadge status={status} />
        </div>
      ) : null}
    </div>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: string; label: string }[];
  value: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="rok-tabs" role="tablist">
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            className="rok-tab button"
            onClick={() => onChange?.(tab.value)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function DataTable({
  columns,
  rows,
}: {
  columns: {
    key: string;
    label: string;
    numeric?: boolean;
    render?: (value: unknown, row: Record<string, unknown>) => ReactNode;
  }[];
  rows: Record<string, unknown>[];
}) {
  return (
    <table className="rok-table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} className={cx("eyebrow", column.numeric && "rok-num")}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={String(row.id ?? index)}>
            {columns.map((column) => {
              const value = row[column.key];
              return (
                <td key={column.key} className={column.numeric ? "rok-num" : undefined}>
                  {column.render ? column.render(value, row) : String(value ?? "")}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RangeField({
  id,
  label,
  value,
  min,
  max,
  step,
  display,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="rok-field range-field" id={id}>
      <span className="rok-field__label eyebrow">
        {label} <span className="data-sm range-value">{display}</span>
      </span>
      <input
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={display}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
