import type { ReactNode } from "react";

export interface PlacementChip {
  id: string;
  col: number;
  row: number;
  heat: number;
}

function heatBin(heat: number): number {
  return Math.floor(Math.max(0, Math.min(0.999, heat)) * 5) + 1;
}

export function PlacementMap({
  chips,
  cols = 8,
  rows = 5,
  cell = 72,
  selected,
  onSelect,
  label,
}: {
  chips: PlacementChip[];
  cols?: number;
  rows?: number;
  cell?: number;
  selected?: string;
  onSelect?: (id: string) => void;
  label?: string;
}) {
  const pad = 8;
  const width = cols * cell;
  const height = rows * cell;
  const slots: ReactNode[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      slots.push(
        <rect
          key={`s-${col}-${row}`}
          className="rok-map__slot"
          x={col * cell}
          y={row * cell}
          width={cell}
          height={cell}
        />,
      );
    }
  }

  return (
    <figure className="rok-map">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label ?? "Chip placement map"}
      >
        {slots}
        {chips.map((chip) => {
          const x = chip.col * cell;
          const y = chip.row * cell;
          const selectedClass = chip.id === selected ? "rok-map__chip--selected" : "";
          return (
            <g key={chip.id} onClick={() => onSelect?.(chip.id)}>
              <title>{`${chip.id} · stress ${Math.round(chip.heat * 100)}%`}</title>
              <rect
                className={`rok-map__chip rok-heat-${heatBin(chip.heat)} ${selectedClass}`}
                x={x + pad}
                y={y + pad}
                width={cell - 2 * pad}
                height={cell - 2 * pad - 14}
              />
              <text className="rok-map__label" x={x + cell / 2} y={y + cell - 8}>
                {chip.id}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="rok-map__legend eyebrow">
        Low stress
        {[1, 2, 3, 4, 5].map((step) => (
          <span key={step} className={`rok-map__swatch rok-heat-${step}`} aria-hidden="true" />
        ))}
        High stress
      </figcaption>
    </figure>
  );
}

export function tileLayout(count: number, prefix: string, heat: number): {
  cols: number;
  rows: number;
  cell: number;
  chips: PlacementChip[];
} {
  if (count <= 0) {
    return { cols: 1, rows: 1, cell: 56, chips: [] };
  }
  const cols = Math.min(12, Math.max(1, Math.ceil(Math.sqrt(count))));
  const rows = Math.ceil(count / cols);
  const chips: PlacementChip[] = [];
  for (let index = 0; index < count; index += 1) {
    chips.push({
      id: `${prefix}${index + 1}`,
      col: index % cols,
      row: Math.floor(index / cols),
      heat,
    });
  }
  return { cols, rows, cell: count > 40 ? 36 : 56, chips };
}
