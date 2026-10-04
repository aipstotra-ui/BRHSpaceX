import { z } from "zod";

import type { Vehicle } from "@/lib/engine/orbit/lifetime";
import { chipSpecSchema, payloadConfigSchema } from "@/lib/schemas/chipSpec";
import type { OrbitPreset } from "@/lib/store/orbit";

/** Bump when the saved shape changes. A case with another version is reported, never guessed at. */
export const CASE_VERSION = 1;

const orbitPresetSchema = z.enum([
  "initial",
  "sso-dawn",
  "sso-noon",
  "starlink-shell",
  "custom",
]) satisfies z.ZodType<OrbitPreset>;

const vehicleSchema = z.object({
  massKg: z.number(),
  dragAreaM2: z.number(),
  cd: z.number(),
  eolAltitudeKm: z.number(),
}) satisfies z.ZodType<Vehicle>;

/** The orbit inputs a case keeps: exactly the fields of the orbit store that a person sets. */
export const orbitInputsSchema = z.object({
  altitudeKm: z.number(),
  inclinationDeg: z.number(),
  sunSynchronous: z.boolean(),
  ltanHours: z.number().nullable(),
  raanDeg: z.number(),
  preset: orbitPresetSchema,
  vehicle: vehicleSchema,
});

/** The chip inputs a case keeps: the preset it started from, the spec as edited, the payload. */
export const chipInputsSchema = z.object({
  presetId: z.string().min(1),
  spec: chipSpecSchema,
  payload: payloadConfigSchema,
});

export const caseInputsSchema = z.object({
  chip: chipInputsSchema,
  orbit: orbitInputsSchema,
});

export const caseLogEntrySchema = z.object({
  at: z.iso.datetime(),
  kind: z.enum(["created", "saved", "export"]),
  text: z.string(),
});

export const caseDocSchema = z.object({
  version: z.literal(CASE_VERSION),
  id: z.string().min(1),
  name: z.string().trim().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  inputs: caseInputsSchema,
  log: z.array(caseLogEntrySchema),
});

export type OrbitInputs = z.infer<typeof orbitInputsSchema>;
export type ChipInputs = z.infer<typeof chipInputsSchema>;
export type CaseInputs = z.infer<typeof caseInputsSchema>;
export type CaseLogEntry = z.infer<typeof caseLogEntrySchema>;
export type CaseDoc = z.infer<typeof caseDocSchema>;
