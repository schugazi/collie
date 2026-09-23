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

// A numbered diff row, up to and including its sign column.
const DIFF_GUTTER = /^\s*\d+ [ +-]/;

/** Columns to hang a wrapped row's continuation by; 0 when the row has no indent or no text. */
export function hangIndent(text: string): number {
  const n = text.match(PREFIX)?.[0].length ?? 0;
  return n >= text.length ? 0 : Math.min(n, MAX_HANG);
}

/**
 * {@link hangIndent} for a block's rows in order, knowing the diff each row sits in. Claude wraps a
 * long diff line itself, and its continuation rows carry the sign but no line number
 * (`         -us the ORIGINAL`), so on its own such a row hangs under the sign, or past it when the
 * text after the sign opens with a space and reads as a bullet. Under a numbered row, a row blank up
 * to that row's sign column, with a sign or a space there and text after it, hangs just past the sign
 * like the numbered row's own code does.
 */
export function hangIndents(rows: readonly string[]): number[] {
  let sign = -1;
  return rows.map((text) => {
    const gutter = text.match(DIFF_GUTTER);
    if (gutter) sign = gutter[0].length - 1;
    else if (sign >= 0 && isDiffContinuation(text, sign)) return Math.min(sign + 1, MAX_HANG);
    else sign = -1;
    return hangIndent(text);
  });
}

function isDiffContinuation(text: string, sign: number): boolean {
  const mark = text[sign];
  return (
    (mark === "+" || mark === "-" || mark === " ") &&
    text.slice(0, sign).trim() === "" &&
    text.slice(sign + 1).trim() !== ""
  );
}
