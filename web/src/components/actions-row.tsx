import { Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Collapse } from "@/components/ui/collapse";
import { HarnessBar, useHarnessBarItems } from "@/components/harness-bar";
import { OverflowEdges } from "@/components/ui/overflow-edges";
import { SectionLabel } from "@/components/ui/section-label";
import { STRIP_ROW_PILL, STRIP_SCROLLER } from "@/components/ui/labelled-strip";
import { useLocale } from "@/hooks/use-locale";
import { t as translate } from "@/lib/i18n";
import type { OperatorCommand } from "@/lib/types";
import { cn } from "@/lib/utils";

// TWO ROWS OF ACTIONS, DIRECTLY ABOVE THE INPUT. Collie's own controls on the top row — Keys, Type,
// Quick, Agent, the display gear — and the running harness's own commands on the row under it, in a
// section of their own. Nothing wraps and nothing is dropped.
//
// IT WAS ONE SCROLLING ROW, AND THE OPERATOR ASKED FOR TWO (2026-09-22): "shows two rows rather than
// requiring horizontal scrolling to see all the options". One row held ~817px of pills on a Claude
// pane against a 382px band, so the harness half was always a flick away. Split, each row fits a
// 390px phone on its own. Each row is still a scroller underneath, so a narrower phone, a longer
// locale or an operator's ten-row bar pans instead of wrapping — the fallback, no longer the layout.
//
// IT IS A BELT: ONE FULL-BLEED BAND, NOT FLOATING CAPSULES. The rows are one continuous strip that
// runs edge to edge, closed below by a hairline, with a quiet ground of its own. Collie's controls
// stand DIRECTLY on that ground with no outline at all; the harness's commands stand in a SECTION of
// the band — a square-cornered rectangle spanning its row's full height, tinted with the harness's
// brand. The tint boundary is what separates the two parts; there is no divider and no thick left
// border, which is a house rule we do not break.
//
// THE GROUND IS AN OPERATOR'S CALL THAT OVERRIDES DESIGN.md §4, AND IT SAYS SO HERE ON PURPOSE.
// §4 is "chrome separates with a rule, not a fill". A belt IS a fill, Altan asked for one by name,
// and this band alone takes it — §4 still governs every other strip of chrome in the app.
//
// WHICH fill was measured, not chosen. The belt sits on the composer's chrome block (`--chrome`:
// rgb 235 light, rgb 23 dark) and BOTH its neighbours are that same ground — the chrome above it
// and the input below, which is `bg-transparent` over it. So the ground had to separate from
// `--chrome` in both themes, and no single token does: `--muted` IS `--chrome` in light (1.00:1,
// invisible) and `--card` IS `--chrome` in dark (1.00:1, invisible). An alpha wash of the
// FOREGROUND is the one recipe that is symmetric by construction, because the foreground flips with
// the theme: black at 6% darkens the light ground, white at 6% lightens the dark one. Measured
// against `--chrome`:
//
//    bg-foreground/6   1.13:1 light (rgb 221)  ·  1.16:1 dark (rgb 37)
//    bg-accent         1.06:1 light            ·  1.19:1 dark   (asymmetric, near-nothing in light)
//    bg-background     1.09:1 light            ·  1.11:1 dark   (but rgb 10 in dark IS the terminal
//                                                                mirror's fill — a hole, not a band)
//
// EACH ROW CARRIES ITS OWN FAINT BRAND TINT (`bg-primary/10`), and the Switch cell takes the
// composer's own ground, `bg-chrome` — the operator's call from the phone (playground round four,
// option 6 of the `belt-ground` deck; see git history). The tint marks the part of the belt that
// can PAN; the Switch cell never pans and is the one control that LEAVES the pane rather than acting
// on it, so it reads as ONE surface with the composer row under the belt.
//
// THE HAIRLINE IS `--border`, NOT `--rule`. The belt's lower neighbour is the same chrome surface it
// stands on, so that is a component edge inside one surface, which is what `--border` is for.
// `border-b` alone: the belt stands flush under the mirror and the chrome block's own
// `border-t border-rule` is the boundary up there, so a second rule here would be two lines where
// the language says one. No rounded ends anywhere either: a belt with rounded corners is a capsule.
//
// THE BELT'S RIGHT END IS THE SWITCH MARK, A CELL AS TALL AS BOTH ROWS. It sits above Send, where
// the thumb already is. With two rows neither row had the ~45px to hold it and still fit, so the
// operator picked a tall cell beside both over moving it off the belt — and the rows' pills
// tightened (STRIP_ROW_PILL) to buy that width back. It is a flex SIBLING of the rows, not laid
// over them, so it covers nothing and needs no fade, spacer or measured inset.
//
// NO BARE BELT, ANYWHERE (operator, from the phone, 2026-09-22). The cell takes up to 44px of what
// the rows leave, and on a narrower phone gives ground down to 32px before a row has to pan. Past
// that the rows take the rest, and every pill grows (STRIP_ROW_PILL's `grow`) so the buttons spread
// over the whole row instead of bunching at the left with empty belt after them.
//
// WHY THE GENERAL PART IS ON TOP. It is the part that is ALWAYS there. The harness row is absent on
// a bare shell, on grok, on opencode, and whenever the operator has the Settings switch off — so
// leading with it would make the top-left mean a different thing per pane, and the thumb could not
// learn one position. The top-left is Keys on every pane there is.
//
// EVERY PILL IS AN ICON AND A WORD, IN BOTH ROWS. The general part was icon-only for half a day, and
// Altan's verdict on it was that it "looks alien to what we've added now for harness specific
// stuff": two parts that are meant to read as one belt cannot hold two different kinds of pill.
//
// The general pills DRAW a short word and ANNOUNCE the full one (`word` vs `label` below): the row
// has one word of room per pill, and "Type into terminal" and "Display settings" are still what a
// screen reader hears and what a test addresses.

/** The row's "on" look — an open dock, an armed mode. `hover:` is pinned to the same tint: without
 *  it, hovering an already-on control repaints it with the ghost variant's hover background and it
 *  reads as switching off under the cursor. */
const ON = "bg-control-on text-control-on-foreground hover:bg-control-on";
const OFF = "text-muted-foreground";

/**
 * One row of the belt's scroller. `py-1` makes the row 40px — the pill's 32px plus 4px above and
 * below; the operator read the bare 32px as too thin. `overflow-y-hidden` is the pair of that:
 * `STRIP_TAP_TARGET`'s `::before` still reaches past 4px of padding, and `overflow-x: auto` forces
 * `overflow-y` to compute to `auto` too, which would turn that overflow into a vertical scrollbar
 * under a thumb. `px-1` is a 4px gutter at both ends — the pills spread over the row now, so the
 * route's full 12px gutter read as a gap on the left (operator, from the phone).
 */
const BELT_ROW = "bg-primary/10 px-1 py-1 overflow-y-hidden";

/**
 * One of Collie's own actions. The composer owns every one of these — what it does, whether it is
 * on, whether it is refused — and this file owns only how it is drawn.
 */
export interface GeneralAction {
  /** Stable, for React's key. Never shown. */
  id: string;
  icon: LucideIcon;
  /** ALREADY TRANSLATED. The button's accessible name — what a reader announces and what a test
   *  addresses. It is never shortened for the paint. */
  label: string;
  /** ALREADY TRANSLATED. The word the pill DRAWS, when the accessible name is too long to wear: the
   *  row shows "Type" and announces "Type into terminal". Defaults to {@link label}.
   *
   *  It must be a prefix-or-part of `label` and never a different word — a visible word the
   *  accessible name does not contain is the WCAG 2.5.3 failure, and it also means a person saying
   *  "tap Display" and a reader hearing "Display settings" are no longer talking about one button. */
  word?: string;
  /** Draws the "on" tint: the dock this opens is open, or the mode it arms is armed. */
  on?: boolean;
  /** Set for a control that opens a dock — it becomes `aria-expanded`. */
  expanded?: boolean;
  /** Set for a control that toggles a mode — it becomes `aria-pressed`. */
  pressed?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface ActionsRowProps {
  /** Collie's own actions, in the order the thumb should meet them. */
  general: readonly GeneralAction[];
  /** The focused pane's agent — picks the harness section and its brand colour. */
  agent: string | undefined | null;
  /** The snapshot's `operatorCommands`; the `bar = true` ones replace the shipped bar (ADR 0043). */
  mine?: readonly OperatorCommand[];
  /** Bound to `(t) => send(t, false)`. Resolving true drives the harness checkmark. */
  onRun: (text: string) => Promise<boolean>;
  /** Bound to the composer's `locked`. Greys the harness buttons in place. */
  disabled?: boolean;
  /**
   * THE PANE SWITCHER, AT THE BELT'S RIGHT END. Absent by default, and absent is the whole of the
   * old behaviour: nothing renders and the rows keep their own right gutter.
   *
   * It used to be a 30px band of its own above the composer, then a small up-chevron centred on this
   * belt's top rule — which stood over whichever pill was in the middle of the band ("it is now
   * blocking the Quick action, it's a bad spot"). So it is a cell at the belt's right end, directly
   * above Send, as tall as both rows.
   *
   * THE TWO HALVES LAND ON TWO DIFFERENT ELEMENTS, AND THAT IS THE DESIGN. `ref` goes on the BELT —
   * the outer element, not the button — so a drag upward from anywhere on the band opens the
   * switcher. `onClick` is the button's, which is the thing that LOOKS tappable and is the only
   * thing a tap may hit.
   *
   * The anchor is unchanged by any of this: {@link import("@/hooks/use-sheet-pull")} measures its
   * node's top edge, and its node is still the belt, so the sheet peeks from the same line it always
   * did.
   *
   * The belt wears `touch-pan-x` for it (`touch-action: pan-x`): the browser keeps the rows' sideways
   * pan and hands vertical movement to the hook, which then decides per gesture which axis a touch
   * belongs to (use-sheet-pull.ts's header holds the arbitration).
   */
  handle?: {
    /** {@link import("@/hooks/use-sheet-pull").useSheetPull}'s ref — the finger-tracked drag. It
     *  lands on the BELT, not on the button: the whole band is the drag surface. */
    ref: (node: HTMLElement | null) => void;
    /** The tap, on the SWITCH BUTTON. Opens the same switcher sheet the drag opens. */
    onClick: () => void;
    /** ALREADY TRANSLATED. The button's accessible name — "Switch pane". */
    label: string;
    /** Another pane needs you: a red dot on the mark's corner. The label says so in words. */
    alert?: boolean;
  };
}

export function ActionsRow({ general, agent, mine, onRun, disabled, handle }: ActionsRowProps) {
  useLocale();

  const harnessItems = useHarnessBarItems(agent, mine);

  // Nothing to draw at all. Render nothing rather than an empty scroller, so the belt costs no
  // height.
  if (general.length === 0 && harnessItems.length === 0) return null;

  // The harness row keeps NO gutter: its tinted section grows over the whole row and carries the
  // gutter as its own padding (harness-bar.tsx), so the tint runs from the screen edge to the Switch
  // cell's hairline — or the other screen edge (operator's call from the phone, 2026-09-22).
  const controlsRowClass = cn(STRIP_SCROLLER, BELT_ROW);
  const harnessRowClass = cn(STRIP_SCROLLER, BELT_ROW, "px-0");

  return (
    <div
      data-slot="composer-actions"
      // THE BELT ITSELF, and the ground and the rule go HERE rather than on the rows inside it: this
      // is the element carrying the `-mx-3` that cancels the dock's `px-3`, so a fill or a rule
      // drawn here runs edge to edge. Drawn one level in, the band would stop 12px short of both
      // screen edges and read as a wide capsule.
      // NO TOP MARGIN AND NO TOP RULE, and both are the same decision. The belt is the FIRST thing
      // in the chrome block, and the block already closes itself against the mirror with
      // `border-t border-rule` (agent-chat.tsx) — a rule here would be the doubled seam DESIGN.md §4
      // forbids. `mb-1` below separates the belt from the input, which has no rule of its own.
      //
      // THIS ELEMENT IS THE DRAG SURFACE. `handle.ref` attaches here and not to the button, so an
      // upward drag anywhere on the band brings the switcher up (`handle` above says why). With it
      // comes `touch-pan-x`, and only with it — `touch-pan-x` with no listener behind it would
      // forbid a vertical page gesture and give nothing back.
      ref={handle?.ref}
      className={cn("-mx-3 mb-1 flex border-b border-border bg-foreground/6", handle && "touch-pan-x")}
    >
      {/* The rows start from their widest row's own width and `grow` into whatever the Switch cell
          does not take; `min-w-0` still lets them shrink and pan on a phone too narrow for both. */}
      <div className="flex min-w-0 grow flex-col">
        {/* Each row is its own OverflowEdges scroller, so a row that does overflow — a narrow phone,
            a long locale — fades only its own hidden end. `cue="none"`: the tint and the fade carry
            the cue, and a chevron was tried here and read as clutter (operator's call, 2026-09-14).
            `flex-none` overrides the wrapper's `flex-1`, which in this column would share the
            belt's height out between the rows instead of letting each take its own 40px. */}
        {general.length > 0 && (
          <OverflowEdges className="flex-none" cue="none">
            {(scrollerRef) => (
              <div ref={scrollerRef} className={controlsRowClass}>
                {/* The word "Controls" is `sr-only` and load-bearing: sighted it labelled a run of
                    self-labelling buttons and earned nothing, but in the accessibility tree it is
                    the only thing that names this group at all. The harness section names itself,
                    separately, for the same reason. */}
                <div
                  data-slot="composer-controls"
                  role="group"
                  aria-labelledby="composer-controls-label"
                  // NO BOX OF ITS OWN. Collie's controls stand directly on the belt's ground: no
                  // outline, no ground, no padding — a group in the accessibility tree and a flex run
                  // in the paint. `gap-0.5` is the belt's one pill gap (STRIP_ROW_PILL says why it
                  // is 2px now). `grow` spans the row, so the pills inside can spread over it.
                  className="flex shrink-0 grow items-center gap-0.5"
                >
                  <SectionLabel id="composer-controls-label" className="sr-only">
                    {translate("composer.controls.label")}
                  </SectionLabel>
                  {general.map((action) => (
                    <Button
                      key={action.id}
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={action.disabled}
                      aria-label={action.label}
                      aria-expanded={action.expanded}
                      aria-pressed={action.pressed}
                      onClick={action.onSelect}
                      className={cn(`${STRIP_ROW_PILL} gap-1 text-[11px]`, action.on === true ? ON : OFF)}
                    >
                      <action.icon className="size-4 shrink-0" />
                      {action.word ?? action.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </OverflowEdges>
        )}
        {/* The harness row can come and go under an OPEN pane — the agent exits to its shell, one
            starts in a shell, the Settings switch flips — and it is 40px of the belt, so it folds
            through `Collapse` rather than jumping the controls and the mirror by a whole row. A pane
            that opens with it (or without it) paints that way from the first frame. */}
        <Collapse open={harnessItems.length > 0}>
          {harnessItems.length > 0 && (
            <OverflowEdges className="flex-none" cue="none">
              {(scrollerRef) => (
                <div ref={scrollerRef} className={harnessRowClass}>
                  <HarnessBar agent={agent} mine={mine} onRun={onRun} disabled={disabled} />
                </div>
              )}
            </OverflowEdges>
          )}
        </Collapse>
      </div>
      {/* THE SWITCH CELL, AS TALL AS BOTH ROWS. A sibling of the rows rather than laid over them, so
          it covers nothing that scrolls and the rows need no spacer or fade to step around it. Its
          ground is the composer's own chrome, and its left hairline — the belt's rule colour, never
          a heavy edge — is what says "the rows end here".
          THE MARK ALONE, NO WORD. It wore "Switch" beside the mark for a day; Altan: "the switch
          button is taking up too much room for my taste, I'd argue we can just have the icon." So
          the accessible name is the only name it has, and a test addresses that name. The mark keeps
          the accent, which is what sets this control apart from the pills beside it.
          The button fills the cell, so its hit box is its drawn box and no `::before` reach is
          needed. The cell's width is the header's "no bare belt" rule in flex terms: from nothing
          (`basis-0`), it takes free width FIRST — `grow-1000` against the rows' `grow` hands it
          nearly all of it — until it stops at 44px (`max-w-11`), and the rows get the rest. When
          there is less than 32px free it holds 32px (`min-w-8`) and the rows pan instead. */}
      {handle && (
        <span className="flex min-w-8 max-w-11 grow-1000 basis-0 border-l border-border bg-chrome">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={handle.label}
            aria-haspopup="dialog"
            onClick={handle.onClick}
            className="h-auto flex-1 touch-manipulation select-none rounded-none px-0 has-[>svg]:px-0"
          >
            {/* The red dot rides the mark's own top-right corner, absolutely placed so it never
                moves the belt. `ring-chrome` cuts it out of the glyph it overlaps. */}
            <span className="relative flex">
              <Layers className="size-4 shrink-0 text-primary" />
              {handle.alert === true && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-1 -right-1 size-2 rounded-full bg-status-blocked ring-2 ring-chrome"
                />
              )}
            </span>
          </Button>
        </span>
      )}
    </div>
  );
}
