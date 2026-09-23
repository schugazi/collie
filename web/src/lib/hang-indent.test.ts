import { describe, expect, it } from "vitest";

import { hangIndent } from "./hang-indent";

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
