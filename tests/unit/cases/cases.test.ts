import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_CASE_NAME, logExport, newCase, renameCase, saveInputs } from "@/lib/cases/ops";
import { caseDocSchema, CASE_VERSION, type CaseInputs } from "@/lib/cases/schema";
import { applyInputs, captureInputs } from "@/lib/cases/snapshot";
import {
  CASES_STORAGE_KEY,
  CaseStoreError,
  createCaseStore,
  createUnavailableCaseStore,
  type StorageLike,
} from "@/lib/cases/store";
import { DEFAULT_PRESET_ID, PRESETS, getPreset } from "@/lib/presets";
import { useShellStore } from "@/lib/store";
import { useOrbitStore } from "@/lib/store/orbit";

const T0 = new Date("2026-10-04T12:00:00.000Z");
const T1 = new Date("2026-10-04T12:05:00.000Z");
const T2 = new Date("2026-10-04T12:10:00.000Z");

function memoryStorage(initial?: string): StorageLike & { raw: () => string | null } {
  const map = new Map<string, string>();
  if (initial !== undefined) {
    map.set(CASES_STORAGE_KEY, initial);
  }
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    raw: () => map.get(CASES_STORAGE_KEY) ?? null,
  };
}

function resetStores() {
  const preset = getPreset(DEFAULT_PRESET_ID);
  useShellStore.getState().setStudio({ presetId: preset.id, spec: preset.spec, payload: preset.payload });
  useOrbitStore.getState().applyPreset("initial");
}

function inputs(): CaseInputs {
  return captureInputs();
}

beforeEach(resetStores);

describe("the case document", () => {
  it("is what captureInputs reads, and parses back clean", () => {
    const doc = newCase({ id: "a", inputs: inputs(), now: T0 });
    expect(caseDocSchema.parse(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
    expect(doc.version).toBe(CASE_VERSION);
    expect(doc.name).toBe(DEFAULT_CASE_NAME);
    expect(doc.log.map((item) => item.kind)).toEqual(["created"]);
  });

  it("refuses a case with a missing chip field, a wrong version, or an empty name", () => {
    type Loose = { inputs: { chip: { spec: Record<string, unknown> } } } & Record<string, unknown>;
    const good = JSON.parse(JSON.stringify(newCase({ id: "a", inputs: inputs(), now: T0 }))) as Loose;
    expect(caseDocSchema.safeParse(good).success).toBe(true);
    const noField = structuredClone(good);
    delete noField.inputs.chip.spec.nodeNm;
    expect(caseDocSchema.safeParse(noField).success).toBe(false);
    expect(caseDocSchema.safeParse({ ...good, version: 2 }).success).toBe(false);
    expect(caseDocSchema.safeParse({ ...good, name: "   " }).success).toBe(false);
    expect(caseDocSchema.safeParse({ ...good, createdAt: "yesterday" }).success).toBe(false);
  });
});

describe("the case operations", () => {
  it("names a new case from the name given, trimmed, or the default", () => {
    expect(newCase({ id: "a", name: "  Dawn SSO  ", inputs: inputs(), now: T0 }).name).toBe("Dawn SSO");
    expect(newCase({ id: "a", name: "   ", inputs: inputs(), now: T0 }).name).toBe(DEFAULT_CASE_NAME);
  });

  it("renames, and leaves the document alone for a blank or unchanged name", () => {
    const doc = newCase({ id: "a", name: "One", inputs: inputs(), now: T0 });
    expect(renameCase(doc, "Two", T1)).toMatchObject({ name: "Two", updatedAt: T1.toISOString() });
    expect(renameCase(doc, "  ", T1)).toBe(doc);
    expect(renameCase(doc, "One", T1)).toBe(doc);
  });

  it("logs a save only when the inputs changed", () => {
    const doc = newCase({ id: "a", inputs: inputs(), now: T0 });
    expect(saveInputs(doc, inputs(), T1)).toBe(doc);
    useOrbitStore.getState().setAltitudeKm(700);
    const saved = saveInputs(doc, inputs(), T1);
    expect(saved.inputs.orbit.altitudeKm).toBe(700);
    expect(saved.log.map((item) => item.kind)).toEqual(["created", "saved"]);
    expect(saved.updatedAt).toBe(T1.toISOString());
    expect(doc.inputs.orbit.altitudeKm).not.toBe(700);
  });

  it("logs an export without touching the inputs", () => {
    const doc = newCase({ id: "a", inputs: inputs(), now: T0 });
    const sent = logExport(doc, T1);
    expect(sent.inputs).toBe(doc.inputs);
    expect(sent.log.at(-1)).toMatchObject({ kind: "export", at: T1.toISOString() });
  });
});

describe("the case store", () => {
  it("lists nothing, and no problem, before anything is saved", () => {
    expect(createCaseStore(memoryStorage()).list()).toEqual({ cases: [], problems: [] });
  });

  it("saves, reads back, replaces by id, lists newest first, and removes", () => {
    const store = createCaseStore(memoryStorage());
    const a = newCase({ id: "a", name: "A", inputs: inputs(), now: T0 });
    const b = newCase({ id: "b", name: "B", inputs: inputs(), now: T1 });
    store.save(a);
    store.save(b);
    expect(store.list().cases.map((item) => item.id)).toEqual(["b", "a"]);
    expect(store.get("a")).toEqual(a);
    expect(store.get("missing")).toBeNull();

    store.save(renameCase(a, "A, renamed", T2));
    const after = store.list().cases;
    expect(after.map((item) => item.id)).toEqual(["a", "b"]);
    expect(after).toHaveLength(2);
    expect(after[0].name).toBe("A, renamed");

    store.remove("a");
    expect(store.list().cases.map((item) => item.id)).toEqual(["b"]);
  });

  it("reports a damaged case and keeps it on disk instead of dropping it", () => {
    const good = newCase({ id: "good", name: "Good", inputs: inputs(), now: T0 });
    const damaged = { ...JSON.parse(JSON.stringify(good)), id: "damaged", inputs: { chip: {}, orbit: {} } };
    const storage = memoryStorage(JSON.stringify({ version: 1, cases: [good, damaged] }));
    const store = createCaseStore(storage);
    const listing = store.list();
    expect(listing.cases.map((item) => item.id)).toEqual(["good"]);
    expect(listing.problems).toEqual(["Saved case 2 is damaged and was left alone."]);

    store.save(newCase({ id: "other", inputs: inputs(), now: T1 }));
    expect(storage.raw()).toContain('"id":"damaged"');
  });

  it("says a case from another version was left alone", () => {
    const future = { ...JSON.parse(JSON.stringify(newCase({ id: "f", inputs: inputs(), now: T0 }))), version: 2 };
    const listing = createCaseStore(memoryStorage(JSON.stringify({ version: 1, cases: [future] }))).list();
    expect(listing.cases).toEqual([]);
    expect(listing.problems).toEqual(["Saved case 1 was written by another version of 3rok and was left alone."]);
  });

  it("reports unreadable JSON and a missing list, and loses nothing it cannot read", () => {
    expect(createCaseStore(memoryStorage("{nope")).list().problems).toEqual([
      "The saved cases could not be read. They are not valid JSON.",
    ]);
    expect(createCaseStore(memoryStorage(JSON.stringify({ version: 1 }))).list().problems).toEqual([
      "The saved cases could not be read. The list is missing.",
    ]);
  });

  it("raises a plain error when the browser refuses the write, and when storage is switched off", () => {
    const full: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
    };
    expect(() => createCaseStore(full).save(newCase({ id: "a", inputs: inputs(), now: T0 }))).toThrow(CaseStoreError);

    const off: StorageLike = {
      getItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
      setItem: () => undefined,
    };
    expect(createCaseStore(off).list().problems).toEqual(["Saved cases are not available in this browser."]);

    const none = createUnavailableCaseStore();
    expect(none.list().cases).toEqual([]);
    expect(none.get("a")).toBeNull();
    expect(() => none.save(newCase({ id: "a", inputs: inputs(), now: T0 }))).toThrow(CaseStoreError);
  });
});

describe("applying a case to the input stores", () => {
  it("puts the chip, payload, orbit and vehicle back exactly, and keeps the saved orbit preset", () => {
    const chip = PRESETS[1];
    useShellStore.getState().setStudio({ presetId: chip.id, spec: { ...chip.spec, shieldingMmAl: 7 }, payload: chip.payload });
    useOrbitStore.getState().applyPreset("sso-dawn");
    const saved = inputs();
    expect(saved.orbit.preset).toBe("sso-dawn");

    resetStores();
    expect(inputs()).not.toEqual(saved);

    applyInputs(saved);
    expect(inputs()).toEqual(saved);
    expect(useOrbitStore.getState().preset).toBe("sso-dawn");
    expect(useShellStore.getState().spec.shieldingMmAl).toBe(7);
  });
});
