import { expect, test, type Page } from "@playwright/test";

import { en } from "@/lib/i18n/messages/en";

import { installApiStub, pinLocale } from "./fixtures/api";

// A LIST ROUTE COMES BACK WHERE IT WAS LEFT (`src/hooks/use-kept-scroll.ts`). The scroller is the
// route's own div, the parent of its `main`; a short viewport gives the fixture room to scroll. A row
// is opened by a dispatched click, because Playwright's own click scrolls the row into view first.

test.beforeEach(async ({ page }) => {
  await installApiStub(page);
  await pinLocale(page, "en");
  await page.setViewportSize({ width: 390, height: 360 });
});

const scroller = (page: Page) => page.getByRole("main").locator("..");
const scrollTop = (page: Page) => scroller(page).evaluate((el) => el.scrollTop);

async function scrollDown(page: Page) {
  await scroller(page).evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(0);
  // The offset is recorded from the scroll event, which lands a frame after the write.
  await page.evaluate(() => new Promise(requestAnimationFrame));
  return scrollTop(page);
}

test("the dashboard keeps its scroll across a trip into a pane", async ({ page }) => {
  await page.goto("/");
  const left = await scrollDown(page);
  await page.getByRole("button", { name: /codex/i }).last().dispatchEvent("click");
  await expect(page.getByRole("button", { name: en["chat.switcher.aria"] })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => scrollTop(page)).toBe(left);
});

test("a space view keeps its scroll across a trip into a pane", async ({ page }) => {
  await page.goto("/space/w2");
  const left = await scrollDown(page);
  await page.getByRole("button", { name: /codex/i }).last().dispatchEvent("click");
  await expect(page.getByRole("button", { name: en["chat.switcher.aria"] })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/space\/w2$/);
  await expect.poll(() => scrollTop(page)).toBe(left);
});
