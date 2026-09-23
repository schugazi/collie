import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MenuModel, StyledLine } from "@/lib/blocks";
import {
  MENU_DOWN_KEYS,
  MENU_LEFT_KEYS,
  MENU_RIGHT_KEYS,
  MENU_UP_KEYS,
} from "@/lib/harness/menu-hints";
import { MIRROR_INVERT, MIRROR_SPACE, styleFor } from "@/components/mirror-space";
import { OptionGroupCaption, PromptPanel } from "@/components/option-button";
import { t } from "@/lib/i18n";
import { useLocale } from "@/hooks/use-locale";

/** What a tap asks for: the keys to send, and whether it commits nothing — an arrow, or the footer's
 *  Esc — which takes the weaker identity-only guard in lib/menu-action.ts. */
export interface MenuBlockAction {
  keys: string[];
  nav: boolean;
}

export interface MenuBlockProps {
  /** The detected menu: its title, the keys its footer named, and the nav it advertised. */
  menu: MenuModel;
  /** The region's own styled lines — rendered verbatim above the controls (see below). */
  lines: StyledLine[];
  /**
   * Injected send handler (from AgentChat). Presentational contract: this component NEVER touches
   * the network — the race guard and the send live in lib/menu-action.ts.
   */
  onAction: (action: MenuBlockAction) => void | Promise<void>;
  /** Read-only device or a gone pane: everything renders (for context) but can't be pressed. */
  disabled?: boolean;
}

// Native, tappable rendering of a generic modal menu — the `/model` picker and its kin.
//
// Unlike the other block renderers this one KEEPS the terminal region visible above the controls,
// and that is the whole design: the grammar understands the screen's FOOTER, not its body, so the
// options, their descriptions and the `❯` highlight only exist as terminal text. Replacing them with
// a synthesised list would be inventing structure we did not parse. So the body is mirrored verbatim
// and the buttons below it drive it. The one exception is a slider whose grammar DID parse the whole
// body (`nav.leftRight.scale`), drawn natively below.
//
// Text is React text nodes only — colour and weight come from the ANSI parse, never markup. Same XSS
// boundary as the mirror, and the same dark colour space (MIRROR_SPACE/MIRROR_INVERT, ADR 0002),
// because these are the agent's own terminal colours.
//
// There are NO digit buttons, and there never will be: in the `/model` picker a digit confirms AND
// persists the choice as the user's default (.adr/0009). Only footer-named keys and arrows ship.
export function MenuBlock({ menu, lines, onAction, disabled }: MenuBlockProps) {
  useLocale();
  const [sending, setSending] = useState<string | null>(null);
  // An arrow or Cancel tapped while an earlier key is still in flight is QUEUED behind it, never
  // dropped: locking the row swallowed a Cancel tapped right after an arrow, so it took two taps
  // (operator, from the phone). Each queued tap still runs its own identity guard when its turn comes.
  //
  // A COMMIT is never queued: its buttons stay disabled while anything is pending. Queued behind an
  // arrow whose send FAILED, it would pass the signature check against the untouched highlight and
  // commit the row the operator was moving away from.
  //
  // Limit: a queued tap carries its render's revision, so on a multiplexer whose revision moves with
  // the screen (tmux, zellij) the guard refuses it once the key ahead of it landed — a second tap, as
  // before the queue, now with "screen changed" said. Herdr's revision does not move with the screen.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [pending, setPending] = useState(0);
  // Whether a queued tap may still START: false once the block unmounts (the picker left the screen,
  // or the operator left the pane) or goes disabled, so nothing fires after its controls are gone.
  const live = useRef(true);
  useEffect(() => {
    live.current = !disabled;
    return () => {
      live.current = false;
    };
  }, [disabled]);

  function press(id: string, action: MenuBlockAction) {
    if (disabled || (!action.nav && pending > 0)) return;
    setPending((n) => n + 1);
    const run = async () => {
      try {
        if (!live.current) return;
        setSending(id);
        await onAction(action);
      } finally {
        setSending(null);
        setPending((n) => n - 1);
      }
    };
    // Both arms: a rejected tap must not stall every tap queued after it.
    queue.current = queue.current.then(run, run);
  }

  const spinner = (
    <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-label={t("dialog.sendingAria")} />
  );
  // A full-width button's spinner stands OUT of the flow, at its left edge: inserted beside the word
  // it pushed the label sideways for as long as the key was sending (the Cancel "flicker").
  const edgeSpinner = <span className="absolute left-3 flex">{spinner}</span>;
  const scale = menu.nav.leftRight?.scale;

  const navButton = (id: string, label: string, keys: string[], icon: ReactNode) => (
    <button
      key={id}
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={() => press(id, { keys, nav: true })}
      className="flex h-9 min-w-0 flex-1 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground shadow-sm transition-colors active:border-primary/50 active:bg-primary/5 disabled:opacity-60"
    >
      {sending === id ? spinner : icon}
    </button>
  );

  return (
    <PromptPanel ariaLabel={menu.title}>
      <OptionGroupCaption>{menu.title}</OptionGroupCaption>

      {/* A slider whose grammar read its WHOLE ladder (`scale`: Claude's /effort) is drawn natively
          instead: its terminal rows sit far to the right of a full-width pane, so the mirror showed
          a title and an empty strip (operator, from the phone). Every label and the value came from
          the screen, so this invents nothing. The current step is marked by colour alone — no
          weight change, so no step changes width as the value moves. */}
      {scale ? (
        <ol className="m-0 flex flex-wrap justify-center gap-1 p-0 font-mono text-[11px]">
          {scale.map((step, i) => (
            <li
              key={i}
              aria-current={step === menu.nav.leftRight?.label ? "true" : undefined}
              className={cn(
                "rounded-md border px-2 py-1",
                step === menu.nav.leftRight?.label
                  ? "border-primary/60 bg-primary/15 text-foreground"
                  : "border-transparent text-muted-foreground",
              )}
            >
              {step}
            </li>
          ))}
        </ol>
      ) : (
        // The region, mirrored verbatim. Scrolls horizontally on its own so a wide picker never makes
        // the page pan (the option/description columns are laid out for a desktop width).
        <pre
          className={cn(
            "m-0 overflow-x-auto rounded-lg px-2 py-1.5 font-mono text-[11px] leading-[1.25] whitespace-pre",
            MIRROR_SPACE,
            MIRROR_INVERT,
          )}
        >
          {lines.map((line, li) => (
            <span key={li}>
              {li > 0 ? "\n" : null}
              {line.segments.map((s, si) => (
                <span key={si} style={styleFor(s)}>
                  {s.text}
                </span>
              ))}
            </span>
          ))}
        </pre>
      )}

      {/* Arrow cluster — only the directions the screen itself advertised (a `❯` row for Up/Down, an
          "←/→ to <verb>" row for Left/Right). Each is one keystroke; they move a highlight and commit
          nothing, so they take the weaker identity guard. */}
      {(menu.nav.upDown || menu.nav.leftRight !== undefined) && (
        <div className="flex items-center gap-1.5">
          {menu.nav.upDown &&
            navButton("up", t("dialog.menu.moveUp"), MENU_UP_KEYS, <ArrowUp className="size-4" />)}
          {menu.nav.upDown &&
            navButton("down", t("dialog.menu.moveDown"), MENU_DOWN_KEYS, <ArrowDown className="size-4" />)}
          {/* No visible value beside ←/→: the mirror above already shows it, and a label whose width
              tracked the live value resized every arrow as it changed (operator, from the phone). The
              accessible names still carry it. Every arrow is flex-1, so four split the row evenly. */}
          {menu.nav.leftRight !== undefined &&
            navButton(
              "left",
              t("dialog.menu.leftAria", { verb: menu.nav.leftRight.verb, label: menu.nav.leftRight.label }),
              MENU_LEFT_KEYS,
              <ArrowLeft className="size-4" />,
            )}
          {menu.nav.leftRight !== undefined &&
            navButton(
              "right",
              t("dialog.menu.rightAria", { verb: menu.nav.leftRight.verb, label: menu.nav.leftRight.label }),
              MENU_RIGHT_KEYS,
              <ArrowRight className="size-4" />,
            )}
        </div>
      )}

      {/* The footer's own actions. Cancel (Esc) is de-emphasised like every other abort affordance in
          the block family — it is not a peer of the things that commit.
          Cancel goes out as `nav` too: Esc commits nothing, so it takes the arrows' identity-only
          guard. On the full signature check, a Cancel tapped just after an arrow was refused as
          "screen changed" whenever the phone's copy still showed the pre-arrow highlight or value,
          and needed a second tap (operator, from the phone). */}
      <div className="flex flex-col gap-1">
        {menu.actions
          .filter((a) => !a.cancel)
          .map((action, i) => {
            const id = `action-${i}`;
            return (
              <button
                key={id}
                type="button"
                disabled={disabled || pending > 0}
                onClick={() => press(id, { keys: action.keys, nav: false })}
                className="font-content relative flex w-full items-center justify-center rounded-lg border border-primary/60 bg-primary/15 px-3 py-2 text-sm font-medium text-foreground transition-colors active:bg-primary/25 disabled:opacity-60"
              >
                {sending === id ? edgeSpinner : null}
                {action.label}
              </button>
            );
          })}
        {menu.actions
          .filter((a) => a.cancel)
          .map((action, i) => {
            const id = `cancel-${i}`;
            return (
              <button
                key={id}
                type="button"
                disabled={disabled}
                onClick={() => press(id, { keys: action.keys, nav: true })}
                className="font-content relative flex w-full items-center justify-center rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors active:bg-muted disabled:opacity-60"
              >
                {sending === id ? edgeSpinner : null}
                {action.label}
              </button>
            );
          })}
      </div>
    </PromptPanel>
  );
}
