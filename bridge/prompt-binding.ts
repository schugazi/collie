/**
 * Normalize a rendered prompt region for comparison across terminal redraws.
 *
 * A terminal redraw can append trailing padding or change blank-line layout without changing the
 * question, so trailing whitespace and blank lines are ignored. Leading indentation and internal
 * alignment must survive because they can be semantic content in a displayed diff or command.
 */
// The two control characters are spliced in from their code points rather than written as escapes
// in the literal: matching them IS the point here, and a regex literal that says so is (correctly)
// flagged as suspicious wherever it isn't. `\x1b[` is the 7-bit CSI, `\x9b` its 8-bit form.
const CSI = `(?:${String.fromCodePoint(0x1b)}\\[|${String.fromCodePoint(0x9b)})`;
const SGR_SEQUENCE = new RegExp(`${CSI}[0-?]*[ -/]*m`, "g");

export function normalizePromptRegion(text: string): string[] {
  return text
    .replace(SGR_SEQUENCE, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .filter((line) => line.length > 0);
}

// Across all 20 committed fixture regions, at most one normalized line follows a match. Six lines
// leave generous headroom for a status or spinner update while ensuring a replacement prompt, whose
// regions span 20 to 32 normalized lines, pushes a stale match outside the accepted tail.
export const DEFAULT_PROMPT_TAIL_LINES = 6;

// Claude Code parks its task panel UNDER an open dialog: "8 tasks (3 done, 1 in progress, 4 open)",
// at most five `✔`/`◻`/`◼` rows, then an optional "… +3 completed" row counting the rest. The tail
// window is measured above it, so only a real panel moves the window: the header's count must equal
// the rows shown plus the overflow row's counts, which transcript text shaped like a list won't meet.
// The client reads the same shape (`taskPanelStart`, web/src/lib/harness/claude/markers.ts).
const TASK_PANEL_HEADER = /^(\d+) tasks? \(.+\)$/;
const TASK_PANEL_ROW = /^[✔◻◼] /;
const TASK_PANEL_OVERFLOW = /^… \+\d/;
const TASK_PANEL_SHOWN = 5;
export const TASK_PANEL_MAX_LINES = TASK_PANEL_SHOWN + 2;

/** How many of `lines` (normalized: no blank rows) are a trailing task panel, or 0. */
export function trailingTaskPanelLines(lines: string[]): number {
  let i = lines.length - 1;
  let hidden = 0;
  if (i >= 0 && TASK_PANEL_OVERFLOW.test(lines[i]!.trim())) {
    for (const n of lines[i]!.match(/\d+/g) ?? []) hidden += Number(n);
    i--;
  }
  let shown = 0;
  while (i >= 0 && TASK_PANEL_ROW.test(lines[i]!.trim())) {
    shown++;
    i--;
  }
  if (i < 0 || shown === 0 || shown > TASK_PANEL_SHOWN) return 0;
  const header = TASK_PANEL_HEADER.exec(lines[i]!.trim());
  return header !== null && Number(header[1]) === shown + hidden ? lines.length - i : 0;
}

export type PromptBindingResult =
  | { ok: true }
  | { ok: false; reason: "empty" | "not_found" | "not_in_tail" };

export function verifyExpectedPrompt(
  freshText: string,
  expected: string,
  tailLines = DEFAULT_PROMPT_TAIL_LINES,
): PromptBindingResult {
  const freshLines = normalizePromptRegion(freshText);
  const expectedLines = normalizePromptRegion(expected);
  if (expectedLines.length === 0) return { ok: false, reason: "empty" };

  let lastMatch = -1;
  candidate: for (let start = 0; start <= freshLines.length - expectedLines.length; start++) {
    for (let offset = 0; offset < expectedLines.length; offset++) {
      if (freshLines[start + offset] !== expectedLines[offset]) continue candidate;
    }
    lastMatch = start;
  }
  if (lastMatch === -1) return { ok: false, reason: "not_found" };

  const boundedTailLines = Math.max(0, Math.floor(tailLines));
  const tailEnd = freshLines.length - trailingTaskPanelLines(freshLines);
  const tailStart = Math.max(0, tailEnd - boundedTailLines);
  const matchEnd = lastMatch + expectedLines.length - 1;
  if (matchEnd < tailStart) return { ok: false, reason: "not_in_tail" };
  return { ok: true };
}
