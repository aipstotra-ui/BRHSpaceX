import { caseDocSchema, type CaseDoc } from "@/lib/cases/schema";

/** The one localStorage key. The value is `{ version, cases }`, checked with zod on every read. */
export const CASES_STORAGE_KEY = "3rok.cases.v1";

/** The part of the Web Storage API the store uses, so a test can hand in a plain object. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface CaseListing {
  /** Cases that read back clean, newest first. */
  cases: CaseDoc[];
  /** One plain sentence for each saved case that could not be read. Never dropped silently. */
  problems: string[];
}

export interface CaseStore {
  list(): CaseListing;
  get(id: string): CaseDoc | null;
  /** Insert or replace by id. Throws CaseStoreError when the browser refuses the write. */
  save(doc: CaseDoc): void;
  remove(id: string): void;
}

export class CaseStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaseStoreError";
  }
}

const UNAVAILABLE = "Saved cases are not available in this browser.";

function readRaw(storage: StorageLike): { rows: unknown[]; problems: string[] } {
  let text: string | null;
  try {
    text = storage.getItem(CASES_STORAGE_KEY);
  } catch {
    return { rows: [], problems: [UNAVAILABLE] };
  }
  if (text === null) {
    return { rows: [], problems: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { rows: [], problems: ["The saved cases could not be read. They are not valid JSON."] };
  }
  const rows =
    typeof parsed === "object" && parsed !== null && "cases" in parsed ? (parsed as { cases: unknown }).cases : null;
  if (!Array.isArray(rows)) {
    return { rows: [], problems: ["The saved cases could not be read. The list is missing."] };
  }
  return { rows, problems: [] };
}

function readAll(storage: StorageLike): CaseListing {
  const raw = readRaw(storage);
  const cases: CaseDoc[] = [];
  const problems = [...raw.problems];
  raw.rows.forEach((row, index) => {
    const checked = caseDocSchema.safeParse(row);
    if (checked.success) {
      cases.push(checked.data);
      return;
    }
    const version = typeof row === "object" && row !== null && "version" in row ? (row as { version: unknown }).version : null;
    problems.push(
      version !== null && version !== 1
        ? `Saved case ${index + 1} was written by another version of 3rok and was left alone.`
        : `Saved case ${index + 1} is damaged and was left alone.`,
    );
  });
  cases.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  return { cases, problems };
}

function writeAll(storage: StorageLike, rows: unknown[]): void {
  try {
    storage.setItem(CASES_STORAGE_KEY, JSON.stringify({ version: 1, cases: rows }));
  } catch {
    throw new CaseStoreError("The browser would not save this case. Its storage may be full or switched off.");
  }
}

/**
 * A case store over any Storage-like object. Cases that fail the schema are left in place on disk
 * (so a newer version of the app can still read them) and reported by list().
 */
export function createCaseStore(storage: StorageLike): CaseStore {
  return {
    list: () => readAll(storage),
    get: (id) => readAll(storage).cases.find((item) => item.id === id) ?? null,
    save(doc) {
      const raw = readRaw(storage);
      const rows = raw.rows.filter((row) => !(typeof row === "object" && row !== null && (row as { id?: unknown }).id === doc.id));
      writeAll(storage, [doc, ...rows]);
    },
    remove(id) {
      const raw = readRaw(storage);
      writeAll(
        storage,
        raw.rows.filter((row) => !(typeof row === "object" && row !== null && (row as { id?: unknown }).id === id)),
      );
    },
  };
}

/** A store for a browser with no usable storage: it lists nothing, says why, and refuses to save. */
export function createUnavailableCaseStore(): CaseStore {
  return {
    list: () => ({ cases: [], problems: [UNAVAILABLE] }),
    get: () => null,
    save() {
      throw new CaseStoreError(UNAVAILABLE);
    },
    remove() {
      throw new CaseStoreError(UNAVAILABLE);
    },
  };
}

/** The store for this browser. Client only: call it from an effect or an event handler. */
export function getCaseStore(): CaseStore {
  try {
    return createCaseStore(window.localStorage);
  } catch {
    return createUnavailableCaseStore();
  }
}
