import type { CaseDoc, CaseInputs, CaseLogEntry } from "@/lib/cases/schema";
import { CASE_VERSION } from "@/lib/cases/schema";

/** What a new case is called until the person renames it. */
export const DEFAULT_CASE_NAME = "New case";

function entry(kind: CaseLogEntry["kind"], text: string, now: Date): CaseLogEntry {
  return { at: now.toISOString(), kind, text };
}

/** A new case from the inputs as they stand. Pure: the id and the clock are handed in. */
export function newCase(args: { id: string; name?: string; inputs: CaseInputs; now: Date }): CaseDoc {
  const name = args.name?.trim() ? args.name.trim() : DEFAULT_CASE_NAME;
  const at = args.now.toISOString();
  return {
    version: CASE_VERSION,
    id: args.id,
    name,
    createdAt: at,
    updatedAt: at,
    inputs: args.inputs,
    log: [entry("created", "Case created from the current inputs.", args.now)],
  };
}

export function renameCase(doc: CaseDoc, name: string, now: Date): CaseDoc {
  const next = name.trim();
  if (next === "" || next === doc.name) {
    return doc;
  }
  return { ...doc, name: next, updatedAt: now.toISOString() };
}

/** Replace the inputs and log the save. Returns the same document when nothing changed. */
export function saveInputs(doc: CaseDoc, inputs: CaseInputs, now: Date): CaseDoc {
  if (JSON.stringify(doc.inputs) === JSON.stringify(inputs)) {
    return doc;
  }
  return {
    ...doc,
    inputs,
    updatedAt: now.toISOString(),
    log: [...doc.log, entry("saved", "Inputs saved.", now)],
  };
}

/** Log that the case was sent to the testing page. The bridge moves no data, only the id. */
export function logExport(doc: CaseDoc, now: Date): CaseDoc {
  return {
    ...doc,
    updatedAt: now.toISOString(),
    log: [...doc.log, entry("export", "Exported to testing.", now)],
  };
}
