import { useCallback } from "react";
import { useLocation } from "react-router";

// A list route's scroller is its own `overflow-y-auto` div, not the document (the shipped HTML locks
// document scrolling), so the browser's and React Router's scroll restoration never see it, and the
// route unmounts on every trip into a pane. Its offset is kept here, per address, for the page's life.
const kept = new Map<string, number>();

/**
 * Ref for a route's scroller: it comes back at the offset it was left at whenever the same address
 * (path and query, so each space and each host keeps its own) is shown again, by Back or by a tap.
 */
export function useKeptScroll() {
  const { pathname, search } = useLocation();
  const key = pathname + search;
  return useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;
      el.scrollTop = kept.get(key) ?? 0;
      const keep = () => kept.set(key, el.scrollTop);
      el.addEventListener("scroll", keep, { passive: true });
      return () => el.removeEventListener("scroll", keep);
    },
    [key],
  );
}
