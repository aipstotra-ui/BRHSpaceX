import { z } from "zod";

import { cheapestAction, uncorrectable, actionCost, ACTIONS } from "@/lib/engine/costCheck";
import { orbitImpact } from "@/lib/engine/orbitImpact";
import { CLIMATOLOGY_SENTENCE } from "@/lib/engine/orbit/climatology";
import { rankOrbits, type OrbitCandidate } from "@/lib/engine/orbit/optimizer";
import { fccAltitudeSchema, inclinationSchema, ltanSchema } from "@/lib/engine/orbit/schema";
import { ssoInclinationDeg } from "@/lib/engine/orbit/sso";
import type { RangeValue } from "@/lib/engine/orbit/range";
import { replayOnOrbit } from "@/lib/engine/replayOnOrbit";
import { buildHourlyFromFeeds, computeFeatureMap, issueTimeIso, vectorFromMap } from "@/lib/ml/features";
import { calibrateQuantiles, type TargetName } from "@/lib/ml/forecast";
import { chipSpecSchema, payloadConfigSchema } from "@/lib/schemas/chipSpec";
import { scenarioSchema } from "@/lib/scenario/schema";
import { runScenario } from "@/lib/scenario/run";
import modelCard from "@/public/models/model-card.json";

import type { CopilotState } from "@/lib/grok/copilotState";

/** estimate: how many ranked orbits the copilot returns. */
export const RANK_TOP_N = 3;

const emptyObject = z.object({}).strict();

export const setOrbitInput = z.object({
  altitudeKm: fccAltitudeSchema,
  inclinationDeg: inclinationSchema.optional(),
  ltanH: ltanSchema.optional(),
  sso: z.boolean().optional(),
});

export const setChipSpecInput = z
  .object({
    spec: chipSpecSchema.partial().optional(),
    payload: payloadConfigSchema.partial().optional(),
  })
  .refine((value) => value.spec !== undefined || value.payload !== undefined, {
    message: "Provide a chip spec field or a payload field",
  });

export const recommendInput = z.object({
  kp: z.number().finite().gte(0).lte(9),
  saa: z.number().finite().gte(0).lte(1).optional(),
  sigmaBits: z.number().finite().positive().optional(),
});

export const rankInput = z.object({
  topN: z.number().int().gte(1).lte(20).optional(),
});

export const spaceWeatherOutput = z.object({
  label: z.literal("source"),
  kp: z.object({ value: z.number(), timeTag: z.string(), unit: z.literal("1") }).nullable(),
  dst: z.object({ value: z.number(), timeTag: z.string(), unit: z.literal("nT") }).nullable(),
  bzNt: z.object({ value: z.number(), timeTag: z.string(), unit: z.literal("nT") }).nullable(),
  speedKmS: z.object({ value: z.number(), timeTag: z.string(), unit: z.literal("km/s") }).nullable(),
  densityCm3: z.object({ value: z.number(), timeTag: z.string(), unit: z.literal("1/cm3") }).nullable(),
});

export const forecastOutput = z.object({
  label: z.literal("estimate"),
  issue: z.string(),
  bands: z.array(
    z.object({
      target: z.enum(["kp", "dst"]),
      horizonH: z.number(),
      p10: z.number(),
      p50: z.number(),
      p90: z.number(),
      unit: z.string(),
    }),
  ),
});

export const chipImpactOutput = z.object({
  label: z.literal("estimate"),
  altitudeKm: z.number(),
  upsetPerS: z.number(),
  /** "raw" bit flips, or "uncorrectable" DRAM errors (the only DRAM quantity with a measurement). */
  upsetKind: z.enum(["raw", "uncorrectable"]),
  annualDose: z.number(),
  lifetimeYears: z.number(),
  binding: z.string(),
  eclipseFraction: z.number(),
  /** Null when power, radiator area, or the temperature limit is not given. */
  thermalMarginC: z.number().nullable(),
});

export const bestMoveOutput = z.object({
  label: z.literal("estimate"),
  action: z.enum(ACTIONS),
  kp: z.number(),
  saa: z.number(),
  sigmaBits: z.number(),
  uncorrectable: z.number(),
  costs: z.array(z.object({ action: z.enum(ACTIONS), cost: z.number() })),
});

export const backtestOutput = z.object({
  label: z.string(),
  altitudeKm: z.number(),
  defaultAltitudeKm: z.number(),
  deltaCost: z.number(),
  deltaDowntimeHours: z.number(),
  deltaUncorrectable: z.number(),
  deltaDose: z.number(),
  firstNonContinue: z.string().nullable(),
});

export const orbitSetOutput = z.object({
  altitudeKm: z.number(),
  inclinationDeg: z.number(),
  sunSynchronous: z.boolean(),
  ltanHours: z.number().nullable(),
  label: z.literal("estimate"),
});

export const chipSetOutput = z.object({
  presetId: z.string(),
  name: z.string(),
  memoryCapacity: z.number(),
  avgPowerKw: z.number(),
  radiatorAreaM2: z.number(),
});

export const rankOutput = z.object({
  label: z.literal("climatology-based"),
  topNLabel: z.literal("estimate"),
  note: z.string(),
  orbits: z.array(
    z.object({
      altitudeKm: z.number(),
      inclinationDeg: z.number(),
      ltanHours: z.number(),
      score: z.number(),
      lifetimeYears: z.number(),
      binding: z.string(),
      deltaVMs: z.number(),
      deltaVLabel: z.literal("illustrative"),
      climatology: z.literal("climatology-based"),
    }),
  ),
});

export const scenarioOutput = z.object({
  label: z.literal("SCENARIO"),
  kp: z.number(),
  action: z.string(),
  hours: z.number(),
  warning: z.string().optional(),
});

export const toolErrorOutput = z.object({ error: z.string() });

type ToolSpec = {
  name: string;
  description: string;
  input: z.ZodType;
};

const TOOL_SPECS: ToolSpec[] = [
  {
    name: "get_space_weather",
    description: "Latest Kp, Dst, Bz, solar-wind speed, and density from the SWPC feeds.",
    input: emptyObject,
  },
  {
    name: "get_forecast",
    description: "Kp and Dst P10, P50, and P90 at +3, +6, +12, and +24 hours. Label them estimate.",
    input: emptyObject,
  },
  {
    name: "get_chip_impact",
    description: "Upset rate, dose, lifetime, eclipse fraction, and thermal margin for the current chip and orbit.",
    input: emptyObject,
  },
  {
    name: "recommend_best_move",
    description: "Cheapest action for a Kp: continue, checkpoint, throttle, or safe mode.",
    input: recommendInput,
  },
  {
    name: "run_backtest",
    description: "May 2024 replay delta of the current orbit versus the default orbit.",
    input: emptyObject,
  },
  {
    name: "set_chip_spec",
    description: "Update chip spec or radiator payload fields. Partial objects merge onto the current spec.",
    input: setChipSpecInput,
  },
  {
    name: "set_orbit",
    description: "Move Starmind. altitudeKm is required, in kilometres, inside the FCC 500 to 2000 km range.",
    input: setOrbitInput,
  },
  {
    name: "rank_orbits",
    description: "Rank sun-synchronous orbits. Say the result is climatology-based. Delta-v is illustrative.",
    input: rankInput,
  },
  {
    name: "run_scenario",
    description: "What-if storm. Say the result is a scenario.",
    input: scenarioSchema,
  },
];

function parametersFor(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-07" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

export const GROK_TOOLS = TOOL_SPECS.map((tool) => ({
  type: "function" as const,
  name: tool.name,
  description: tool.description,
  parameters: parametersFor(tool.input),
}));

export type ToolDeps = {
  readFeed?: (feed: string) => Promise<unknown>;
  runModel?: (file: string, features: Float32Array, outputName: string) => Promise<number>;
  now?: Date;
};

export type ToolExecution = {
  output: string;
  state: CopilotState;
  changed: boolean;
};

function failure(state: CopilotState, message: string): ToolExecution {
  return { output: JSON.stringify({ error: message }), state, changed: false };
}

function done(state: CopilotState, payload: unknown, changed = false): ToolExecution {
  return { output: JSON.stringify(payload), state, changed };
}

function lastFinite(rows: unknown, pick: (row: Record<string, unknown>) => number | null): { value: number; timeTag: string } | null {
  if (!Array.isArray(rows)) {
    return null;
  }
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (typeof row !== "object" || row === null) {
      continue;
    }
    const record = row as Record<string, unknown>;
    const value = pick(record);
    if (value !== null && Number.isFinite(value)) {
      const timeTag = typeof record.time_tag === "string" ? record.time_tag : "";
      return { value, timeTag };
    }
  }
  return null;
}

function point(
  sample: { value: number; timeTag: string } | null,
  unit: "1" | "nT" | "km/s" | "1/cm3",
) {
  if (!sample) {
    return null;
  }
  return { value: sample.value, timeTag: sample.timeTag, unit };
}

async function readRequired(deps: ToolDeps, feed: string): Promise<unknown> {
  if (!deps.readFeed) {
    throw new Error("feed reader missing");
  }
  return deps.readFeed(feed);
}

async function getSpaceWeather(state: CopilotState, deps: ToolDeps): Promise<ToolExecution> {
  try {
    const [kp, dst, mag, wind] = await Promise.all([
      readRequired(deps, "kp_1m"),
      readRequired(deps, "dst"),
      readRequired(deps, "rtsw_mag_1m"),
      readRequired(deps, "rtsw_wind_1m"),
    ]);
    const payload = spaceWeatherOutput.parse({
      label: "source",
      kp: point(
        lastFinite(kp, (row) => (typeof row.estimated_kp === "number" ? row.estimated_kp : null)),
        "1",
      ),
      dst: point(
        lastFinite(dst, (row) => (typeof row.dst === "number" ? row.dst : null)),
        "nT",
      ),
      bzNt: point(
        lastFinite(mag, (row) => (typeof row.bz_gsm === "number" ? row.bz_gsm : null)),
        "nT",
      ),
      speedKmS: point(
        lastFinite(wind, (row) => (typeof row.proton_speed === "number" ? row.proton_speed : null)),
        "km/s",
      ),
      densityCm3: point(
        lastFinite(wind, (row) => (typeof row.proton_density === "number" ? row.proton_density : null)),
        "1/cm3",
      ),
    });
    return done(state, payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "space weather failed";
    return failure(state, message);
  }
}

type MagRow = { time_tag: string; bz_gsm: number | null; by_gsm: number | null };
type WindRow = { time_tag: string; proton_speed: number; proton_density: number };
type KpRow = { time_tag: string; Kp: number };
type DstRow = { time_tag: string; dst: number };
type F107Row = { time_tag: string; flux: number; reporting_schedule: string };

async function getForecast(state: CopilotState, deps: ToolDeps): Promise<ToolExecution> {
  try {
    const now = deps.now ?? new Date();
    const [mag, wind, kp, dst, f107] = await Promise.all([
      readRequired(deps, "rtsw_mag_1m"),
      readRequired(deps, "rtsw_wind_1m"),
      readRequired(deps, "kp"),
      readRequired(deps, "dst"),
      readRequired(deps, "f107"),
    ]);
    const issue = issueTimeIso(now);
    const hourly = buildHourlyFromFeeds(
      now,
      mag as MagRow[],
      wind as WindRow[],
      kp as KpRow[],
      dst as DstRow[],
      f107 as F107Row[],
    );
    const vector = vectorFromMap(modelCard.feature_names, computeFeatureMap(hourly, issue));
    const runModel =
      deps.runModel ??
      (async (file: string, features: Float32Array, outputName: string) => {
        const ort = await import("@/lib/ml/ort");
        return ort.runModel(file, features, outputName);
      });
    const raw = new Map<string, { target: TargetName; horizon: number; p10?: number; p50?: number; p90?: number }>();
    for (const model of modelCard.models) {
      const target: TargetName = model.target === "dst" ? "dst" : "kp";
      const key = `${target}-${model.horizon_h}`;
      const slot = raw.get(key) ?? { target, horizon: model.horizon_h };
      const value = await runModel(model.file, vector, model.output_name);
      if (model.quantile === 0.1) {
        slot.p10 = value;
      } else if (model.quantile === 0.5) {
        slot.p50 = value;
      } else {
        slot.p90 = value;
      }
      raw.set(key, slot);
    }
    const bands = [];
    for (const slot of raw.values()) {
      if (slot.p10 === undefined || slot.p50 === undefined || slot.p90 === undefined) {
        continue;
      }
      const tag = `${slot.target}_h${String(slot.horizon).padStart(2, "0")}` as keyof typeof modelCard.calibration;
      const ordered = calibrateQuantiles(slot.target, slot.p10, slot.p50, slot.p90, modelCard.calibration[tag]);
      if (![ordered.p10, ordered.p50, ordered.p90].every((value) => Number.isFinite(value))) {
        continue;
      }
      bands.push({
        target: slot.target,
        horizonH: slot.horizon,
        p10: ordered.p10,
        p50: ordered.p50,
        p90: ordered.p90,
        unit: slot.target === "kp" ? "1" : "nT",
      });
    }
    return done(state, forecastOutput.parse({ label: "estimate", issue, bands }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "forecast failed";
    return failure(state, message);
  }
}

function mid(value: RangeValue): number {
  return value.mid;
}

function getChipImpact(state: CopilotState): ToolExecution {
  const impact = orbitImpact({
    altitudeKm: state.altitudeKm,
    inclinationDeg: state.inclinationDeg,
    sunSynchronous: state.sunSynchronous,
    ltanHours: state.ltanHours,
    raanDeg: state.raanDeg,
    vehicle: state.vehicle,
    spec: state.spec,
    payload: state.payload,
    memoryUnit: state.memoryUnit,
    nodeKnown: state.nodeKnown,
  });
  return done(
    state,
    chipImpactOutput.parse({
      label: "estimate",
      altitudeKm: state.altitudeKm,
      upsetPerS: mid(impact.upsetRate),
      upsetKind: impact.upsetKind,
      annualDose: mid(impact.annualDose),
      lifetimeYears: mid(impact.lifetimeYears),
      binding: impact.binding,
      eclipseFraction: mid(impact.eclipseFraction),
      thermalMarginC: impact.thermalKnown ? mid(impact.thermalMarginC) : null,
    }),
  );
}

function recommendBestMove(state: CopilotState, args: unknown): ToolExecution {
  const parsed = recommendInput.safeParse(args);
  if (!parsed.success) {
    return failure(state, parsed.error.issues[0]?.message ?? "invalid best-move input");
  }
  const saa = parsed.data.saa ?? 0.2;
  const sigmaBits = parsed.data.sigmaBits ?? 1;
  const amount = uncorrectable(parsed.data.kp, saa, sigmaBits);
  const action = cheapestAction(parsed.data.kp, saa, sigmaBits);
  return done(
    state,
    bestMoveOutput.parse({
      label: "estimate",
      action,
      kp: parsed.data.kp,
      saa,
      sigmaBits,
      uncorrectable: amount,
      costs: ACTIONS.map((name) => ({ action: name, cost: actionCost(amount, name) })),
    }),
  );
}

function runBacktest(state: CopilotState): ToolExecution {
  const replay = replayOnOrbit({ altitudeKm: state.altitudeKm, inclinationDeg: state.inclinationDeg });
  return done(
    state,
    backtestOutput.parse({
      label: replay.label,
      altitudeKm: replay.chosen.altitudeKm,
      defaultAltitudeKm: replay.baseline.altitudeKm,
      deltaCost: replay.delta.cost,
      deltaDowntimeHours: replay.delta.downtimeHours,
      deltaUncorrectable: replay.delta.uncorrectable,
      deltaDose: replay.delta.dose,
      firstNonContinue: replay.firstNonContinue,
    }),
  );
}

function setChip(state: CopilotState, args: unknown): ToolExecution {
  const parsed = setChipSpecInput.safeParse(args);
  if (!parsed.success) {
    return failure(state, parsed.error.issues[0]?.message ?? "invalid chip spec");
  }
  const spec = chipSpecSchema.safeParse({ ...state.spec, ...parsed.data.spec });
  const payload = payloadConfigSchema.safeParse({ ...state.payload, ...parsed.data.payload });
  if (!spec.success || !payload.success) {
    return failure(state, "chip spec failed validation");
  }
  const next: CopilotState = {
    ...state,
    spec: spec.data,
    payload: payload.data,
  };
  return done(
    next,
    chipSetOutput.parse({
      presetId: next.presetId,
      name: next.spec.name,
      memoryCapacity: next.spec.memoryCapacity,
      avgPowerKw: next.spec.avgPowerKw,
      radiatorAreaM2: next.payload.radiatorAreaM2,
    }),
    true,
  );
}

function setOrbit(state: CopilotState, args: unknown): ToolExecution {
  const parsed = setOrbitInput.safeParse(args);
  if (!parsed.success) {
    return failure(state, parsed.error.issues[0]?.message ?? "invalid orbit");
  }
  const sunSynchronous = parsed.data.sso ?? state.sunSynchronous;
  const altitudeKm = parsed.data.altitudeKm;
  const inclinationDeg = sunSynchronous
    ? ssoInclinationDeg(altitudeKm)
    : (parsed.data.inclinationDeg ?? state.inclinationDeg);
  const ltanHours = sunSynchronous ? (parsed.data.ltanH ?? state.ltanHours ?? 6) : state.ltanHours;
  const next: CopilotState = {
    ...state,
    altitudeKm,
    inclinationDeg,
    sunSynchronous,
    ltanHours: sunSynchronous ? ltanHours : null,
  };
  return done(
    next,
    orbitSetOutput.parse({
      altitudeKm: next.altitudeKm,
      inclinationDeg: next.inclinationDeg,
      sunSynchronous: next.sunSynchronous,
      ltanHours: next.ltanHours,
      label: "estimate",
    }),
    true,
  );
}

export function publicRankRow(row: OrbitCandidate) {
  return {
    altitudeKm: row.altitudeKm,
    inclinationDeg: row.inclinationDeg,
    ltanHours: row.ltanHours,
    score: row.score,
    lifetimeYears: row.lifetimeYears,
    binding: row.binding,
    deltaVMs: row.deltaVMs,
    deltaVLabel: "illustrative" as const,
    climatology: "climatology-based" as const,
  };
}

function rank(state: CopilotState, args: unknown): ToolExecution {
  const parsed = rankInput.safeParse(args ?? {});
  if (!parsed.success) {
    return failure(state, parsed.error.issues[0]?.message ?? "invalid rank input");
  }
  const topN = parsed.data.topN ?? RANK_TOP_N;
  const ranked = rankOrbits({
    spec: state.spec,
    payload: state.payload,
    vehicle: state.vehicle,
    fromAltitudeKm: state.altitudeKm,
    memoryUnit: state.memoryUnit,
    nodeKnown: state.nodeKnown,
  });
  return done(
    state,
    rankOutput.parse({
      label: "climatology-based",
      topNLabel: "estimate",
      note: CLIMATOLOGY_SENTENCE,
      orbits: ranked.slice(0, topN).map(publicRankRow),
    }),
  );
}

function scenario(state: CopilotState, args: unknown): ToolExecution {
  const parsed = scenarioSchema.safeParse(args);
  if (!parsed.success) {
    return failure(state, parsed.error.issues[0]?.message ?? "invalid scenario");
  }
  const result = runScenario(parsed.data);
  return done(state, scenarioOutput.parse(result));
}

export async function executeGrokTool(
  name: string,
  args: unknown,
  state: CopilotState,
  deps: ToolDeps = {},
): Promise<ToolExecution> {
  switch (name) {
    case "get_space_weather":
      return getSpaceWeather(state, deps);
    case "get_forecast":
      return getForecast(state, deps);
    case "get_chip_impact":
      return getChipImpact(state);
    case "recommend_best_move":
      return recommendBestMove(state, args);
    case "run_backtest":
      return runBacktest(state);
    case "set_chip_spec":
      return setChip(state, args);
    case "set_orbit":
      return setOrbit(state, args);
    case "rank_orbits":
      return rank(state, args);
    case "run_scenario":
      return scenario(state, args);
    default:
      return failure(state, "unknown tool");
  }
}
