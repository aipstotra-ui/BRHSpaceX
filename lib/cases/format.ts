import type { OrbitInputs } from "@/lib/cases/schema";

/** "SSO 06:00 LTAN" or "Inclined orbit": the same words the testing page's top bar uses. */
export function orbitKind(orbit: Pick<OrbitInputs, "sunSynchronous" | "ltanHours">): string {
  return orbit.sunSynchronous ? `SSO ${clockTime(orbit.ltanHours ?? 0)} LTAN` : "Inclined orbit";
}

/** 6.25 → "06:15". The LTAN slider moves in quarter hours. */
function clockTime(hours: number): string {
  const minutes = Math.round(hours * 60) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** One orbit in one line, with capitalised units. */
export function orbitLine(orbit: OrbitInputs): string {
  return `${orbitKind(orbit)} · ${orbit.altitudeKm.toFixed(0)} KM · ${orbit.inclinationDeg.toFixed(1)}°`;
}

/** A UTC minute from an ISO time, the same on the server and in the browser. */
export function utcMinute(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** A fresh id that works on any page, secure or not. */
export function newCaseId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
