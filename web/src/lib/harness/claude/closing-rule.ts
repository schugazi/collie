// The CLOSING RULE a named session draws under some dialogs (Claude Code 2.1.296).
//
// In a session renamed with `/rename` (or started with `--name`), 2.1.296 draws one more rule UNDER
// the key-hint footer of the AskUserQuestion dialogs (a single question, a wizard step, its review
// step, a multiSelect) and of the `/resume` and `/config` panels, and sets the session name into it:
//
//   Enter to select · ↑/↓ to navigate · Esc to cancel
//   ──────────────────────────────────────────────────────────── capture lab ─
//
// An unnamed session draws nothing there, and neither do the permission, plan, trust, `/effort`,
// `/model`, `/status`, `/tasks` or `/permissions` screens in either kind of session. Every grammar
// here anchors on the LAST non-blank row being its footer (or, for the wizard's review step, its
// `2. Cancel` row), so the extra rule made the whole dialog fall to the unread-dialog card with Esc
// only.
//
// The repair is made ONCE, in front of every grammar, by the Claude adapter's entry points
// (`claudeBuildBlocks`, `composerReady`, `modalOnScreen`). The phone's render, the race guard's
// re-derivation (`dialogDetector` goes through `adapter.buildBlocks`) and the unread-dialog probes
// therefore all read the same rows, so a tap's signature is identical on both sides and the bridge's
// binding check sees a region that ends one row above the buffer's end, well inside its tail window
// (`DEFAULT_PROMPT_TAIL_LINES`). No grammar learns about the rule.
//
// FAIL CLOSED. Exactly ONE trailing row is dropped, and only when all of these hold:
//   1. the last non-blank row, or the last one above a task panel or queued messages (markers.ts
//      `dialogTail`), is a horizontal rule: a run of `─`, optionally followed by one short label set
//      into it (` name ─`);
//   2. the nearest non-blank row above it, again above any task panel, ends a key-hint footer Claude recognises
//      (`classifyFooter`, or a `·`-separated hint list `readKeyHintFooter` reads, wrapped or not), or
//      is the wizard review's `1. Submit answers` / `2. Cancel` pair;
//   3. no input box is on the screen, so the idle composer (whose own rules may be labelled with the
//      session name too) is never touched.
// Anything else comes back as the SAME array, untouched.

import { lineText, type StyledLine } from "../../blocks";
import { readKeyHintFooter } from "../menu-hints";
import { hasInputBox } from "./chrome";
import { classifyFooter, dialogTail, isBlank } from "./markers";
import { parseOptionRow } from "./prompt-select";

// A run of rule glyphs and, optionally, ONE label set into it: ` capture lab ─`. The label holds no
// rule glyph of its own, so a row that is two rules glued together, or prose between rules, is not
// one. The floor of three glyphs keeps a stray `──` in output from counting.
const CLOSING_RULE = /^\s*─{3,}(?: [^─\s](?:[^─]*[^─\s])? ─)?\s*$/;

/** Whether `text` is a closing rule: a plain `─` run, or one with a session name set into it. */
export function isClosingRule(text: string): boolean {
  return CLOSING_RULE.test(text);
}

/** The wizard review step's tail: `1. Submit answers` then `2. Cancel`, the last two non-blank rows. */
function endsReviewPair(texts: string[], last: number): boolean {
  const cancel = parseOptionRow(texts[last]!);
  if (!cancel || cancel.n !== 2 || cancel.label !== "Cancel") return false;
  let prev = last - 1;
  while (prev >= 0 && isBlank(texts[prev]!)) prev--;
  if (prev < 0) return false;
  const submit = parseOptionRow(texts[prev]!);
  return submit !== null && submit.n === 1 && submit.label === "Submit answers";
}

/**
 * `lines` without the closing rule 2.1.296 draws under a dialog in a named session, or the very same
 * array when the screen does not end that way. Pure; the caller owns pane access.
 */
export function dropClosingRule(lines: StyledLine[]): StyledLine[] {
  const texts = lines.map(lineText);

  let last = texts.length - 1;
  while (last >= 0 && isBlank(texts[last]!)) last--;
  // The fork's task panel and queued messages (markers.ts `dialogTail`) may sit on either side of
  // the rule: under it, so the rule is the row above them; or above it, between it and the footer.
  const rule = last >= 0 && isClosingRule(texts[last]!) ? last : dialogTail(texts);
  if (rule < 1 || !isClosingRule(texts[rule]!)) return lines;

  // What is left once the rule is gone: the screen a grammar would have read in an unnamed session.
  const head = texts.slice(0, rule);
  const tail = dialogTail(head);
  if (tail < 0) return lines;
  // A second rule is never the footer: a footer reader may fold a rule into a wrapped hint row.
  if (isClosingRule(head[tail]!)) return lines;
  const upToFooter = head.slice(0, tail + 1);
  const endsDialog =
    classifyFooter(head[tail]!, upToFooter) !== null ||
    readKeyHintFooter(upToFooter) !== null ||
    endsReviewPair(head, tail);
  if (!endsDialog) return lines;

  // A composer is on screen, with or without the rule: the rule is its border, not a dialog's.
  // Checked last, as it is the costliest read.
  const rest = rule === last ? lines.slice(0, rule) : lines.filter((_, i) => i !== rule);
  if (hasInputBox(lines) || hasInputBox(rest)) return lines;
  return rest;
}
