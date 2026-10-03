import { z } from "zod";

import type { ChipSpec, PayloadConfig } from "@/lib/types";

export const chipSpecSchema = z.object({
  vendor: z.string().min(1),
  name: z.string().min(1),
  nodeNm: z.number(),
  acceleratorCount: z.number().int().nonnegative(),
  cpuCount: z.number().int().nonnegative(),
  memoryType: z.string().min(1),
  memoryCapacity: z.number().nonnegative(),
  eccScheme: z.string().min(1),
  avgPowerKw: z.number(),
  peakPowerKw: z.number(),
  opTempMinC: z.number(),
  opTempMaxC: z.number(),
  shieldingMmAl: z.number().nonnegative(),
  seuCrossSection: z.number().optional(),
  tidLimitKradSi: z.number().optional(),
  latchupLet: z.number().optional(),
  dieArea: z.number().optional(),
}) satisfies z.ZodType<ChipSpec>;

export const payloadConfigSchema = z.object({
  radiatorAreaM2: z.number(),
  radiatorSides: z.union([z.literal(1), z.literal(2)]),
  tSinkK: z.number(),
  emissivity: z.number(),
}) satisfies z.ZodType<PayloadConfig>;
