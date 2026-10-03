import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { dragDecayYears, estimatedLifetime, timeToTidYears } from "@/lib/engine/orbit/lifetime";
import { rangeValue } from "@/lib/engine/orbit/range";

describe("lifetime", () => {
  it("divides the TID limit by the annual dose and names the binding limit", () => {
    const annual = rangeValue({
      low: 0.1,
      mid: 0.2,
      high: 0.4,
      unit: "krad(Si)/yr",
      label: "estimate",
      assumptions: ["fixture"],
    });
    const tid = timeToTidYears(10, annual);
    expect(tid.low).toBeCloseTo(10 / 0.4);
    expect(tid.mid).toBeCloseTo(10 / 0.2);
    expect(tid.high).toBeCloseTo(10 / 0.1);
    expect(tid.low).toBeLessThanOrEqual(tid.mid);
    expect(tid.mid).toBeLessThanOrEqual(tid.high);
    expect(tid.label).toBe("estimate");

    const drag = rangeValue({
      low: 10,
      mid: 40,
      high: 90,
      unit: "yr",
      label: "estimate",
      assumptions: ["fixture"],
    });
    const life = estimatedLifetime(tid, drag);
    expect(life.binding).toBe("drag");
    expect(life.years.mid).toBe(Math.min(tid.mid, drag.mid));
    expect(life.years.label).toBe("estimate");

    const tidBinds = estimatedLifetime(drag, tid);
    expect(tidBinds.binding).toBe("TID");
    expect(tidBinds.years.mid).toBe(Math.min(drag.mid, tid.mid));
  });

  it("keeps drag-decay low, mid, and high in order", () => {
    const drag = dragDecayYears(800, { massKg: 1000, dragAreaM2: 10, cd: 2.2, eolAltitudeKm: 120 });
    expect(drag.low).toBeLessThanOrEqual(drag.mid);
    expect(drag.mid).toBeLessThanOrEqual(drag.high);
    expect(drag.label).toBe("estimate");
  });

  it("reports the dose fallback instead of a silent pass", () => {
    const output = execFileSync("ml/.venv/bin/python", ["scripts/orbit/dose_table.py", "--check"], {
      encoding: "utf8",
    });
    expect(output).toContain("no reference: estimate");
    expect(output).toContain("leave-one-out is not computed because there are no reference rows");
  });
});
