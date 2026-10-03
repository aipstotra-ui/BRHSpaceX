import { donkiSepSchema } from "@/lib/data/schemas";

/** CCMC base after the 2026-09-30 change. Do not use kauai.ccmc hostnames. */
export const DONKI_BASE = "https://ccmc.gsfc.nasa.gov/DONKI-API/get/";

export type DonkiKind = "GST" | "FLR" | "CME" | "SEP";

export function donkiUrl(kind: DonkiKind, startDate: string, endDate: string): string {
  const url = new URL(`${DONKI_BASE}${kind}`);
  url.searchParams.set("startDate", startDate);
  url.searchParams.set("endDate", endDate);
  return url.toString();
}

export function filterGoesSep<T extends { instruments?: { displayName?: string }[] }>(rows: T[]): T[] {
  return rows.filter((row) =>
    (row.instruments ?? []).some((instrument) => (instrument.displayName ?? "").includes("GOES")),
  );
}

export async function fetchDonkiSep(
  startDate: string,
  endDate: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown[]> {
  const response = await fetchImpl(donkiUrl("SEP", startDate, endDate));
  if (!response.ok) {
    throw new Error("DONKI SEP request failed");
  }
  const parsed = filterGoesSep(donkiSepSchema.parse(await response.json()));
  return parsed;
}
