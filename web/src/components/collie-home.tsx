import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { CollieMark } from "@/components/collie-mark";
import { t } from "@/lib/i18n";
import { useStatus } from "@/lib/status";
import { useOperatorBusy } from "@/lib/busy";
import { useLocale } from "@/hooks/use-locale";

interface CollieHomeProps {
  /** Return to the dashboard. */
  onHome?: () => void;
  /** Pulse after sustained connection trouble (≥4s), avoiding polling flicker. */
  trouble: boolean;
  /** Stop pulsing and mute the mark when the outage escalates (≥15s). */
  lost?: boolean;
  className?: string;
}

// Shared home button and connection indicator. Match the mark’s 1.8s loading pulse.
const ORBIT_TURN_MS = 1800;

// Warp a raised cosine so an event pulse starts quickly and eases out slowly.
// With skew in [0,1), its mean stays 1: one animation cycle per event.
const SPIN_SKEW = 0.5;

export function spinRate(elapsedMs: number, totalMs = ORBIT_TURN_MS): number {
  if (totalMs <= 0) return 1;
  const at = Math.min(Math.max(elapsedMs, 0), totalMs);
  const theta = at / totalMs;
  // The warped clock and its speed. Both are needed: the substitution that keeps the mean at 1 is
  // exactly `(curve ∘ u) · u′`, and dropping the `u′` factor would skew the shape AND spend part of
  // the turn — the round would land short of where it started.
  const u = theta + SPIN_SKEW * theta * (1 - theta);
  const du = 1 + SPIN_SKEW * (1 - 2 * theta);
  return (1 - Math.cos(2 * Math.PI * u)) * du;
}

export function CollieHome({ onHome, trouble, lost = false, className }: CollieHomeProps) {
  useLocale();
  const bloom = trouble && !lost;

  // Connection trouble and operator work pulse continuously; a status event pulses once.
  // Lost connections stay muted. Events in one burst share the same timer.
  const busy = useOperatorBusy();

  const status = useStatus();
  const roundId = status?.id ?? 0;
  const [round, setRound] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ramp only the brief event pulse; sustained loading keeps its normal rate.
  const mark = useRef<HTMLSpanElement>(null);
  const frame = useRef<number | null>(null);
  const ramp = useRef<((rate: number) => void) | null>(null);

  // Every `cm-*` CSS animation under the mark, or null where the ramp cannot run: no element yet, no
  // `getAnimations` (jsdom under test, older engines), or reduced motion — where the stylesheet has
  // already switched every animation off and there is nothing to rate. In each case the round falls
  // back to exactly the square wave it has always been, which is why none of them is an error.
  function collect(): Animation[] | null {
    const el = mark.current;
    // `in`, not a `typeof` probe: the question is whether this DOM implementation HAS the method at
    // all — jsdom under test does not, and neither do older engines — which is a fact about the
    // object, not about the shape of a value we were handed.
    if (el === null || !("getAnimations" in el)) return null;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true) return null;
    return el.getAnimations({ subtree: true }).filter((a) => {
      // SAFETY: `getAnimations` returns transitions as well as animations, and only a CSSAnimation
      // carries `animationName`. The `in` check IS the discriminator — anything without the property
      // is filtered out before the cast is read, so the cast can only ever see a CSSAnimation. The
      // name prefix then keeps this to the mark's own animations, never a caller's `className`.
      const named = "animationName" in a ? (a as CSSAnimation).animationName : "";
      return named.startsWith("cm-");
    });
  }

  useEffect(() => {
    if (roundId === 0 || timer.current !== null) return;
    setRound(true);
    // Wait for loading to render before collecting the mark’s CSS animation.
    const started = performance.now();
    let collected = false;
    const step = () => {
      // Collected ONCE, on the first frame, and never re-attempted — `collected` flips whether or not
      // there was anything to collect. Retrying would walk the subtree 108 times a round on exactly
      // the environments that already told us they cannot answer (no `getAnimations`, reduced
      // motion), which are the ones least able to afford it.
      if (!collected) {
        collected = true;
        const anims = collect();
        ramp.current = anims === null ? () => {} : (rate) => {
          for (const a of anims) a.updatePlaybackRate(rate);
        };
      }
      const elapsed = performance.now() - started;
      ramp.current?.(spinRate(elapsed, ORBIT_TURN_MS));
      frame.current = elapsed >= ORBIT_TURN_MS ? null : requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    timer.current = setTimeout(() => {
      timer.current = null;
      // Restore the normal rate in case sustained loading keeps the pulse mounted.
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      ramp.current?.(1);
      ramp.current = null;
      setRound(false);
    }, ORBIT_TURN_MS);
    // NO CLEANUP HERE, deliberately. React runs an effect's cleanup on every dependency change,
    // before the next run — so a cleanup that cleared the timer would clear the very thing the
    // guard above reads, and the second event of a burst would find the coast clear and restart
    // the round. That is the bug this guard exists to stop. The timer is torn down on UNMOUNT
    // instead, by the effect below.
  }, [roundId]);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );
  return (
    <button
      type="button"
      onClick={onHome}
      // The bloom conveys connection state visually; fold it into the button's accessible name too,
      // so screen-reader users get it (inside a pane there's no other cue).
      aria-label={
        !trouble
          ? t("nav.home.aria.default")
          : lost
            ? t("nav.home.aria.lost")
            : t("nav.home.aria.reconnecting")
      }
      className={cn(
        "-mx-1 flex items-center rounded px-1 transition-opacity active:opacity-70",
        className,
      )}
    >
      {/* The 40px artwork sits in a 44px touch target and dims when disconnected. */}
      {/* The ramp's scope, and the reason this wrapper carries a ref at all: `getAnimations` is
          collected from HERE and not from the button, so the button's own `transition-opacity` — and
          anything a caller's `className` animates — is never handed a playback rate. */}
      <span ref={mark} className="grid size-11 shrink-0 place-items-center">
        <CollieMark
          size={40}
          weight="header"
          loading={bloom || ((round || busy) && !lost)}
          paper="var(--background)"
          className={cn("transition-opacity", lost && "opacity-40 grayscale")}
        />
      </span>
    </button>
  );
}
