import { useEffect, useRef } from "react";
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  ScatterController,
  Tooltip,
} from "chart.js";
import type { ParetoPayload, ParetoPoint } from "@3rok/cesium-plugin";
import { readFont } from "../theme";

Chart.register(
  ScatterController,
  BarController,
  BarElement,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
);

function cssColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

interface RawPoint {
  x: number;
  y: number;
  raw: ParetoPoint;
}

export function ParetoChart({
  payload,
  onSelect,
}: {
  payload: ParetoPayload | null;
  onSelect: (point: ParetoPoint) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !payload) return undefined;
    const front = (payload.pareto_front || []).filter(
      (point) => point.lifetime_years != null && point.lifetime_years > 0 && point.mean_power_kW != null,
    );
    const cloud = (payload.evaluated || []).filter(
      (point) => point.lifetime_years != null && point.mean_power_kW != null,
    );
    const accent = cssColor("--accent");
    const muted = cssColor("--ink-subtle");
    const ink = cssColor("--ink-muted");
    const line = cssColor("--line");
    const font = readFont("--font-mono");
    const costs = front.map((point) => point.shielding_cost ?? 1);
    const minCost = Math.min(...costs, 1);
    const maxCost = Math.max(...costs, 1);
    const radius = (cost: number | null | undefined) => {
      if (cost == null || !Number.isFinite(cost) || maxCost === minCost) return 7;
      const t = (cost - minCost) / (maxCost - minCost);
      return 12 - 6 * t;
    };
    const chart = new Chart(canvas, {
      type: "scatter",
      data: {
        datasets: [
          {
            label: "Evaluated",
            data: cloud.map((point) => ({
              x: point.lifetime_years,
              y: point.mean_power_kW,
              raw: point,
            })),
            backgroundColor: muted,
            pointRadius: 2.5,
            pointHoverRadius: 4,
          },
          {
            label: "Pareto front",
            data: front.map((point) => ({
              x: point.lifetime_years,
              y: point.mean_power_kW,
              raw: point,
            })),
            backgroundColor: accent,
            pointRadius: front.map((point) => radius(point.shielding_cost)),
            pointHoverRadius: front.map((point) => radius(point.shielding_cost) + 2),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_event, elements) => {
          const hit = elements[0];
          if (!hit) return;
          const dataset = chart.data.datasets[hit.datasetIndex];
          const point = dataset?.data?.[hit.index] as RawPoint | undefined;
          if (point?.raw) onSelect(point.raw);
        },
        plugins: {
          legend: {
            labels: { color: ink, font: { family: font, size: 11 } },
          },
          tooltip: {
            callbacks: {
              label(context) {
                const raw = (context.raw as RawPoint).raw;
                const cfg = raw.config;
                return [
                  `${raw.lifetime_years?.toFixed(2) ?? "—"} YR · ${raw.mean_power_kW?.toFixed(1) ?? "—"} KW`,
                  `${cfg.altitude_km.toFixed(0)} KM · ${cfg.inclination} · ${cfg.shield_mm_Al.toFixed(1)} MM`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: "LIFETIME YR", color: ink, font: { family: font, size: 11 } },
            ticks: { color: ink, font: { family: font, size: 11 } },
            grid: { color: line },
          },
          y: {
            title: { display: true, text: "MEAN POWER KW", color: ink, font: { family: font, size: 11 } },
            ticks: { color: ink, font: { family: font, size: 11 } },
            grid: { color: line },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [payload, onSelect]);

  return (
    <div className="chart-box">
      <canvas ref={canvasRef} />
    </div>
  );
}

export interface SensitivityBar {
  label: string;
  lifetime_years: number | null;
  delta_years: number | null;
  relative_change?: number | null;
  limiting_mode?: string;
}

export function SensitivityChart({ bars }: { bars: SensitivityBar[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const accent = cssColor("--accent");
    const critical = cssColor("--status-critical");
    const ink = cssColor("--ink-muted");
    const line = cssColor("--line");
    const font = readFont("--font-mono");
    const chart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: bars.map((bar) => bar.label),
        datasets: [
          {
            label: "Delta lifetime YR",
            data: bars.map((bar) => bar.delta_years ?? 0),
            backgroundColor: bars.map((bar) => ((bar.delta_years ?? 0) < 0 ? critical : accent)),
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            ticks: { color: ink, font: { family: font, size: 11 } },
            grid: { color: line },
          },
          y: {
            ticks: { color: ink, font: { family: font, size: 11 } },
            grid: { display: false },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [bars]);

  return (
    <div className="chart-box chart-box--tall">
      <canvas ref={canvasRef} />
    </div>
  );
}
