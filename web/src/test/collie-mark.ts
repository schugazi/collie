// Shared readers for the dashboard mark and its loading indicator.

/**
 * The one <CollieMark/> inside `root`, or `null`. Identified by the inline stylesheet it carries —
 * a lucide icon in the same tree is also an <svg>, and nothing else in the app ships CSS inside one.
 */
export function collieMark(root: ParentNode): SVGSVGElement | null {
  return root.querySelector<SVGSVGElement>("svg:has(> style)");
}

/** Whether the mark's border is pulsing — i.e. it carries the `cm-live` class. */
export function markIsLive(root: ParentNode): boolean {
  return collieMark(root)?.classList.contains("cm-live") ?? false;
}

/** The loading border colour, still visible with reduced motion; empty if unmounted. */
export function markAccent(root: ParentNode): string {
  return collieMark(root)?.style.getPropertyValue("--cm-a1") ?? "";
}

/** The caller’s background token retained by the shared mark contract, or `""` if no mark is mounted. */
export function markPaper(root: ParentNode): string {
  return collieMark(root)?.style.getPropertyValue("--cm-paper") ?? "";
}
