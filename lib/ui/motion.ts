import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function media(): MediaQueryList | null {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(QUERY) : null;
}

/** True when the visitor asked the system for less motion. False on the server and where matchMedia is missing. */
export function prefersReducedMotion(): boolean {
  return media()?.matches ?? false;
}

function subscribe(onChange: () => void): () => void {
  const list = media();
  if (!list) {
    return () => undefined;
  }
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

/** Live version of prefersReducedMotion() for components; re-renders when the setting changes. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}
