import { describe, expect, it } from "vitest";

import { hangIndent, hangIndents } from "./hang-indent";

describe("hangIndent", () => {
  it.each([
    ["plain prose at column 0", "Herdr works out agent status", 0],
    ["an indented row", "  astra  GPT-6 Astra (Codex bridge)", 2],
    ["a Claude tool result", "  ⎿  Added 3 lines, removed 1 line", 5],
    ["a Claude message bullet", "⏺ Update(/tmp/mirror-shots/shoot.mjs)", 2],
    ["a markdown bullet", "- item", 2],
    ["a numbered list item", "10. Smoothing: a switch", 4],
    ["a recap", "※ recap: We're comparing", 2],
    ["a diff context row", "     1  // Read-only: screenshots", 8],
    ["an added diff row", "     2 +import { createRequire }", 8],
    ["a removed diff row", "    12 -import { chromium }", 8],
    ["a diff row's own code indent", "   24 +  const pre = page.locator", 9],
    ["a hyphenated word, not a bullet", "-import", 0],
    ["a number that is not a list", "  3 apples", 2],
    ["a deep indent, capped", `${" ".repeat(30)}deep`, 16],
    ["a blank row", "    ", 0],
  ])("%s", (_name, text, want) => {
    expect(hangIndent(text)).toBe(want);
  });
});

describe("hangIndents", () => {
  it("hangs a diff line Claude wrapped itself under the text, not the sign", () => {
    // Claude's own wrap of a long removed line: the sign repeats, the line number does not.
    const rows = [
      "⏺ Update(CLAUDE.md)",
      "  ⎿  Added 1 line, removed 1 line",
      "      53  ### Structured-hook internals",
      "      55 -- **Structured hooks are authoritative and never touch a terminal.** pl",
      "         -us the ORIGINAL `tool_input` with only `answers`",
      "         - notification BEFORE publishing ANSWERED, because",
      "          context line wrapped by Claude",
      "      56 +  const pre = page.locator",
      "         +locator(\"pre\")",
      "",
      "         -not a diff any more",
    ];
    // The blank row ends the diff, so the last row hangs by its own indent again.
    expect(hangIndents(rows)).toEqual([2, 5, 10, 10, 10, 10, 10, 12, 10, 0, 9]);
  });

  it("ends the diff at the first row that does not fit its gutter", () => {
    const rows = ["      55 -old", "⏺ Done", "         - a bullet at column 9"];
    expect(hangIndents(rows)).toEqual([10, 2, 11]);
  });
});
