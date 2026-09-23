// Where a mirror row's wrapped continuation starts, in columns: under the first character of the
// row's text, past its indent and at most one list, tool or diff marker. The phone wraps rows the
// terminal printed whole, and a continuation at column 0 cuts through the indent that said what the
// row belonged to: a diff's line numbers, a tool result's ⎿, a bullet, a nested list.
//
// Capped, because a deep indent would leave the continuation a column too narrow to read on a phone.
const MAX_HANG = 16;

// A bullet or prompt glyph, or a markdown number (`1.` / `1)`), each followed by a space; or a diff
// gutter (`12 +`, `12 -`, `12  `), where the code follows the sign directly.
const PREFIX = /^\s*(?:(?:[-*+•●◦▪▸►⏺⎿※❯›>]|\d+[.)])\s+|\d+ [ +-])?\s*/;

/** Columns to hang a wrapped row's continuation by; 0 when the row has no indent or no text. */
export function hangIndent(text: string): number {
  const n = text.match(PREFIX)?.[0].length ?? 0;
  return n >= text.length ? 0 : Math.min(n, MAX_HANG);
}
