import logo from "@/assets/remote-logo.png";

import { MARK_STYLE, beadFill, useMark, type MarkProps, type MarkSpec } from "./mark-contract";

// The fork's mark: the mycroftxxx dashboard emblem (a bitmap) with a ring that pulses while the app
// works. It implements upstream's mark contract (mark-contract.ts) so every state the host asks for
// reads: the ring is three arcs, the mark's three beads, so `applying` and `reconnected` colour it with
// their status colours, `idle` dims the whole mark, and a resting mark runs no animation (`data-rest`).
// The ring is the only line drawn: while live it takes a theme's `--mark-ink`, teal by default.

const STYLE = `${MARK_STYLE}
[data-mark="collie"] { --cm-ink: var(--mark-ink, #40bfc5); }
.cm-live .cm-ring { animation: cm-pulse var(--cm-turn) ease-in-out infinite; }
@keyframes cm-pulse { 50% { opacity: .35; } }
@media (prefers-reduced-motion: reduce) { .cm-ring { animation: none !important; } }`;

const BEADS = 3;

const SPEC: MarkSpec = {
  id: "collie",
  beads: BEADS,
  paced: /^cm-/,
  liveClass: "cm-live",
  look: {
    rest: { "--cm-a1": "transparent" },
    live: { "--cm-a1": "var(--cm-ink)" },
  },
  turnVar: "--cm-turn",
  paperVar: "--cm-paper",
  // The header weight crops to the ring, so the emblem fills a small header slot.
  view: { full: "0 0 192 192", header: "6 6 180 180" },
};

// The ring's three arcs, each a third of its circumference, starting at the top.
const ARC = (2 * Math.PI * 87) / BEADS;

export type CollieMarkProps = MarkProps;

export function CollieMark(props: CollieMarkProps) {
  const m = useMark(SPEC, props);
  return (
    <svg {...m.root}>
      <style>{STYLE}</style>
      <image href={logo} width="192" height="192" />
      {Array.from({ length: BEADS }, (_, i) => (
        <circle
          key={i}
          className="cm-ring"
          cx="96"
          cy="96"
          r="87"
          fill="none"
          stroke={beadFill(i, "var(--cm-a1)")}
          strokeWidth="6"
          strokeDasharray={`${ARC} ${ARC * (BEADS - 1)}`}
          strokeDashoffset={-ARC * i}
          transform="rotate(-90 96 96)"
        />
      ))}
    </svg>
  );
}
