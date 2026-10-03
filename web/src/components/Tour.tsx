import { useEffect, useRef, useState } from "react";
import type { ParetoPoint } from "@3rok/cesium-plugin";
import { Button } from "./ui";

const STEPS = [
  {
    id: "altitude",
    target: "#field-altitude",
    title: "1 · Altitude",
    body: "Drag altitude through the filed envelope. Dose climbs above about 800 km under the AE8/AP8 plus exponential shield model. The lifetime shown is estimated.",
    durationMs: 50_000,
  },
  {
    id: "chip",
    target: "#field-chip",
    title: "2 · Chip",
    body: "Switch the part. Commercial rows use the Trillium 2 krad(Si) anchor. Rad-hard rows use the RAD750 anchor. These are not Starmind or Rubin tolerances.",
    durationMs: 40_000,
  },
  {
    id: "pareto",
    target: "#pareto-panel",
    title: "3 · Pareto front",
    body: "Click a point to load that configuration. The front maximizes lifetime and mean power and minimizes shield mass plus radiator area. Marker size grows as that cost falls.",
    durationMs: 55_000,
  },
  {
    id: "sensitivity",
    target: "#sensitivity-panel",
    title: "4 · Sensitivity",
    body: "One change at a time around the dawn-SSO 800 km baseline. The bars show which knobs move the estimate. They are not flight data.",
    durationMs: 45_000,
  },
] as const;

export function Tour({
  running,
  onRunning,
  onAltitude,
  onToggleChip,
  onPareto,
  pareto,
}: {
  running: boolean;
  onRunning: (running: boolean) => void;
  onAltitude: (km: number) => void;
  onToggleChip: () => void;
  onPareto: (point: ParetoPoint) => void;
  pareto: ParetoPoint[];
}) {
  const [index, setIndex] = useState(0);
  const actions = useRef({ onRunning, onAltitude, onToggleChip, onPareto, pareto });
  actions.current = { onRunning, onAltitude, onToggleChip, onPareto, pareto };

  useEffect(() => {
    if (!running) {
      document.querySelectorAll(".tour-highlight").forEach((node) => {
        node.classList.remove("tour-highlight");
      });
      return undefined;
    }
    const step = STEPS[index];
    if (!step) {
      actions.current.onRunning(false);
      return undefined;
    }
    document.querySelectorAll(".tour-highlight").forEach((node) => {
      node.classList.remove("tour-highlight");
    });
    const target = document.querySelector(step.target);
    target?.classList.add("tour-highlight");
    target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    if (step.id === "altitude") actions.current.onAltitude(1100);
    if (step.id === "chip") actions.current.onToggleChip();
    if (step.id === "pareto" && actions.current.pareto.length) {
      const front = actions.current.pareto;
      actions.current.onPareto(front[Math.floor(front.length / 2)] ?? front[0]);
    }
    const timer = window.setTimeout(() => {
      setIndex((current) => current + 1);
    }, step.durationMs);
    return () => window.clearTimeout(timer);
  }, [running, index]);

  if (!running) return null;
  const step = STEPS[index];
  if (!step) return null;
  const last = index === STEPS.length - 1;

  return (
    <aside className="tour-overlay" aria-live="polite">
      <div className="tour-card">
        <p className="eyebrow tour-step">
          {index + 1} / {STEPS.length}
        </p>
        <h2 className="heading-sm">{step.title}</h2>
        <p className="body">{step.body}</p>
        <div className="tour-actions">
          <Button
            variant="quiet"
            onClick={() => {
              setIndex(0);
              onRunning(false);
            }}
          >
            Skip tour
          </Button>
          <Button
            variant="solid"
            onClick={() => {
              if (last) {
                setIndex(0);
                onRunning(false);
              } else {
                setIndex((current) => current + 1);
              }
            }}
          >
            {last ? "Finish tour" : "Next step"}
          </Button>
        </div>
      </div>
    </aside>
  );
}
