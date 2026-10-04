"use client";

import { useMemo, useSyncExternalStore } from "react";

import type { CaseDoc, CaseInputs } from "@/lib/cases/schema";
import { inputsFromStores } from "@/lib/cases/snapshot";
import { casesSnapshot, listingFromSnapshot, subscribeCases, type CaseListing } from "@/lib/cases/store";
import { useShellStore } from "@/lib/store";
import { useOrbitStore } from "@/lib/store/orbit";

/** The saved cases, or null on the server and on the first client render (the same markup both times). */
export function useCaseListing(): CaseListing | null {
  const snapshot = useSyncExternalStore(subscribeCases, casesSnapshot, () => null);
  return useMemo(() => (snapshot === null ? null : listingFromSnapshot(snapshot)), [snapshot]);
}

export type CaseLookup = { status: "loading" } | { status: "missing" } | { status: "ready"; doc: CaseDoc };

/** One saved case by id. A null id is never found. */
export function useCase(id: string | null): CaseLookup {
  const listing = useCaseListing();
  return useMemo(() => {
    if (listing === null) {
      return { status: "loading" };
    }
    const doc = id === null ? undefined : listing.cases.find((item) => item.id === id);
    return doc ? { status: "ready", doc } : { status: "missing" };
  }, [listing, id]);
}

/** The inputs as they stand in the two input stores right now. */
export function useCurrentInputs(): CaseInputs {
  const shell = useShellStore((state) => state);
  const orbit = useOrbitStore((state) => state);
  return useMemo(() => inputsFromStores(shell, orbit), [shell, orbit]);
}
