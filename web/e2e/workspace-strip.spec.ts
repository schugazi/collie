import { expect, test } from "@playwright/test";

import { en } from "@/lib/i18n/messages/en";

import { installApiStub } from "./fixtures/api";

// THE DASHBOARD'S WORKSPACE STRIP scrolls sideways only. Its chips' 46px tap box reached 6px past a
// `py-0` scroller, so a thumb could nudge the strip up and down on the phone. Same guard as the
// belt's (`belt.spec.ts`): `scrollHeight` equals `clientHeight`, and a hand-written `scrollTop`
// reads back as 0. The viewport is narrowed so the fixture's chips overflow and the sideways half
// is proven too: a hand-written `scrollLeft` sticks.

test.use({ viewport: { width: 200, height: 800 } });

test.beforeEach(async ({ page }) => {
  await installApiStub(page);
});

test("the workspace strip scrolls sideways only", async ({ page }) => {
  await page.goto("/");
  const strip = page.getByRole("navigation", { name: en["space.strip.title"] });
  await expect(strip.getByRole("button").first()).toBeVisible();

  const scroller = await strip.locator(":scope > div").evaluate((el) => {
    el.scrollTop = 20;
    el.scrollLeft = 20;
    return {
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrollTop: el.scrollTop,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollLeft: el.scrollLeft,
    };
  });
  expect(scroller.scrollHeight).toBe(scroller.clientHeight);
  expect(scroller.scrollTop).toBe(0);
  expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
  expect(scroller.scrollLeft).toBeGreaterThan(0);
});
