import { describe, expect, it } from "vitest";

import { defaultCopilotState } from "@/lib/grok/copilotState";
import { rankOrbits } from "@/lib/engine/orbit/optimizer";
import {
  backtestOutput,
  bestMoveOutput,
  chipImpactOutput,
  chipSetOutput,
  executeGrokTool,
  forecastOutput,
  GROK_TOOLS,
  orbitSetOutput,
  publicRankRow,
  rankOutput,
  RANK_TOP_N,
  recommendInput,
  scenarioOutput,
  setChipSpecInput,
  setOrbitInput,
  spaceWeatherOutput,
  toolErrorOutput,
} from "@/lib/grok/tools";

const future = "2099-06-01T12:00:00.000Z";

const scenarioFixture = {
  cmeSpeedKmS: 600,
  bzNt: -30,
  densityCm3: 10,
  durationH: 6,
  arrivalTime: future,
};

function feeds(feed: string): Promise<unknown> {
  if (feed === "kp_1m") {
    return Promise.resolve([
      { time_tag: "2026-01-01T00:00:00Z", kp_index: 4, estimated_kp: 4.2, kp: "4" },
    ]);
  }
  if (feed === "dst") {
    return Promise.resolve([{ time_tag: "2026-01-01T00:00:00Z", dst: -18 }]);
  }
  if (feed === "rtsw_mag_1m") {
    return Promise.resolve([{ time_tag: "2026-01-01T00:01:00Z", bz_gsm: -4.5, by_gsm: 1 }]);
  }
  if (feed === "rtsw_wind_1m") {
    return Promise.resolve([{ time_tag: "2026-01-01T00:01:00Z", proton_speed: 420, proton_density: 6 }]);
  }
  if (feed === "kp") {
    return Promise.resolve([{ time_tag: "2026-01-01T00:00:00Z", Kp: 3 }]);
  }
  if (feed === "f107") {
    return Promise.resolve([{ time_tag: "2026-01-01T12:00:00Z", flux: 120, reporting_schedule: "noon" }]);
  }
  return Promise.resolve([]);
}

describe("copilot tools", () => {
  it("publishes the same tool list for voice and text", () => {
    expect(GROK_TOOLS.map((tool) => tool.name)).toEqual([
      "get_space_weather",
      "get_forecast",
      "get_chip_impact",
      "recommend_best_move",
      "run_backtest",
      "set_chip_spec",
      "set_orbit",
      "rank_orbits",
      "run_scenario",
    ]);
    for (const tool of GROK_TOOLS) {
      expect(tool.type).toBe("function");
      expect(tool.parameters).toMatchObject({ type: "object" });
    }
  });

  it("round-trips each tool input and output", async () => {
    const state = defaultCopilotState();
    const deps = {
      readFeed: feeds,
      runModel: async (file: string) => (file.includes("dst") ? -20 : 3),
      now: new Date("2026-01-01T03:00:00Z"),
    };

    expect(spaceWeatherOutput.parse(JSON.parse((await executeGrokTool("get_space_weather", {}, state, deps)).output)).kp?.value).toBe(4.2);
    const forecast = forecastOutput.parse(JSON.parse((await executeGrokTool("get_forecast", {}, state, deps)).output));
    expect(forecast.bands.length).toBeGreaterThan(0);
    expect(forecast.label).toBe("estimate");
    chipImpactOutput.parse(JSON.parse((await executeGrokTool("get_chip_impact", {}, state)).output));
    recommendInput.parse({ kp: 7.7 });
    bestMoveOutput.parse(JSON.parse((await executeGrokTool("recommend_best_move", { kp: 7.7 }, state)).output));
    backtestOutput.parse(JSON.parse((await executeGrokTool("run_backtest", {}, state)).output));
    setChipSpecInput.parse({ spec: { shieldingMmAl: 4 } });
    chipSetOutput.parse(JSON.parse((await executeGrokTool("set_chip_spec", { spec: { shieldingMmAl: 4 } }, state)).output));
    setOrbitInput.parse({ altitudeKm: 600, sso: true, ltanH: 6 });
    orbitSetOutput.parse(JSON.parse((await executeGrokTool("set_orbit", { altitudeKm: 600 }, state)).output));
    rankOutput.parse(JSON.parse((await executeGrokTool("rank_orbits", {}, state)).output));
    scenarioOutput.parse(JSON.parse((await executeGrokTool("run_scenario", scenarioFixture, state)).output));
  });

  it("rejects an altitude outside the FCC range", async () => {
    const state = defaultCopilotState();
    for (const altitudeKm of [499, 2001]) {
      const result = await executeGrokTool("set_orbit", { altitudeKm }, state);
      expect(result.changed).toBe(false);
      expect(result.state.altitudeKm).toBe(state.altitudeKm);
      expect(toolErrorOutput.parse(JSON.parse(result.output)).error.length).toBeGreaterThan(0);
    }
  });

  it("rejects a scenario outside the published ranges", async () => {
    const state = defaultCopilotState();
    const low = await executeGrokTool("run_scenario", { ...scenarioFixture, cmeSpeedKmS: 10 }, state);
    const high = await executeGrokTool("run_scenario", { ...scenarioFixture, bzNt: -80 }, state);
    const past = await executeGrokTool(
      "run_scenario",
      { ...scenarioFixture, arrivalTime: "2000-01-01T00:00:00Z" },
      state,
    );
    for (const result of [low, high, past]) {
      expect(result.changed).toBe(false);
      expect(toolErrorOutput.parse(JSON.parse(result.output)).error.length).toBeGreaterThan(0);
    }
  });

  it("matches rankOrbits for the same chip and departure altitude", async () => {
    const state = defaultCopilotState();
    const ranked = rankOrbits({
      spec: state.spec,
      payload: state.payload,
      vehicle: state.vehicle,
      fromAltitudeKm: state.altitudeKm,
      memoryUnit: state.memoryUnit,
      nodeKnown: state.nodeKnown,
    });
    const result = await executeGrokTool("rank_orbits", { topN: RANK_TOP_N }, state);
    const parsed = rankOutput.parse(JSON.parse(result.output));
    expect(parsed.label).toBe("climatology-based");
    expect(parsed.orbits).toEqual(ranked.slice(0, RANK_TOP_N).map(publicRankRow));
    expect(parsed.orbits[0]?.deltaVLabel).toBe("illustrative");
  });
});
