"use client";

import { useEffect } from "react";

const SELECTOR = ".table-scroll";

/** Marks a scroll box whose content runs past its right or left edge, so CSS can fade that edge. */
export function markScrollEdges(box: HTMLElement): void {
  const more = box.scrollWidth - box.clientWidth;
  box.toggleAttribute("data-more-right", more > 1 && box.scrollLeft < more - 1);
  box.toggleAttribute("data-more-left", more > 1 && box.scrollLeft > 1);
}

/**
 * Watches every `.table-scroll` box on the page (including ones added later) and keeps its edge marks current.
 * Mount once, in the root layout.
 */
export function ScrollFades() {
  useEffect(() => {
    const tracked = new WeakSet<HTMLElement>();
    const resize = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // The box itself, or the table inside it.
        const box = (entry.target as HTMLElement).closest<HTMLElement>(SELECTOR);
        if (box) {
          markScrollEdges(box);
        }
      }
    });
    const onScroll = (event: Event) => markScrollEdges(event.currentTarget as HTMLElement);
    const boxes = new Set<HTMLElement>();
    const scan = () => {
      for (const box of document.querySelectorAll<HTMLElement>(SELECTOR)) {
        if (tracked.has(box)) {
          continue;
        }
        tracked.add(box);
        boxes.add(box);
        box.addEventListener("scroll", onScroll, { passive: true });
        resize.observe(box);
        const table = box.firstElementChild;
        if (table) {
          resize.observe(table);
        }
        markScrollEdges(box);
      }
    };
    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      mutations.disconnect();
      resize.disconnect();
      for (const box of boxes) {
        box.removeEventListener("scroll", onScroll);
      }
    };
  }, []);
  return null;
}
