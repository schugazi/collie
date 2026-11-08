import { describe, expect, it } from "vitest";

import { shippedThemes } from "@/lib/theme/store";

import { composerLayout } from "./composer-layout";

describe("composerLayout", () => {
  it("is the field when the theme names no word", () => {
    expect(composerLayout(undefined)).toBe("field");
  });

  it("reads each word of the token", () => {
    expect(composerLayout("field")).toBe("field");
    expect(composerLayout("box")).toBe("box");
  });

  // The fork: the default theme keeps the fork's field composer, so no shipped theme names the box.
  it("is the field for every shipped theme, the default included", () => {
    const words = shippedThemes().map((theme) => [theme.id, composerLayout(theme.surface?.composer)]);
    expect(words).toEqual([
      ["collie", "field"],
      ["nightwatch", "field"],
      ["daylight", "field"],
      ["harbour", "field"],
    ]);
  });
});
