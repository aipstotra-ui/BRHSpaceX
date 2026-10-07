import { afterEach, describe, expect, it, vi } from "vitest";

import { useClockStore } from "@/lib/store/clock";
import { prefersReducedMotion } from "@/lib/ui/motion";

describe("reduced motion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is off on the server, where there is no window", () => {
    expect(prefersReducedMotion()).toBe(false);
  });

  it("follows the prefers-reduced-motion media query", () => {
    const queries: string[] = [];
    vi.stubGlobal("window", {
      matchMedia: (query: string) => {
        queries.push(query);
        return { matches: true, addEventListener: () => undefined, removeEventListener: () => undefined };
      },
    });
    expect(prefersReducedMotion()).toBe(true);
    expect(queries).toEqual(["(prefers-reduced-motion: reduce)"]);
  });

  it("never starts playback by itself: the clock begins paused", () => {
    expect(useClockStore.getState().playing).toBe(false);
  });
});
