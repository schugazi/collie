import { expect, test, type Page } from "@playwright/test";

import { en } from "@/lib/i18n/messages/en";

import { installApiStub } from "./fixtures/api";

// BACK OUT OF A PANE LANDS ON THE DASHBOARD OR THE SPACE VIEW IT WAS OPENED FROM (`src/router.tsx`).
// `page.goBack()` pops history the way a swipe does, but it does not model WebKit's gesture skipping
// entries pushed without a tap; every cold case here taps before it backs.

test.beforeEach(async ({ page }) => {
  await installApiStub(page);
});

const switcher = (page: Page) => page.getByRole("button", { name: en["chat.switcher.aria"] });
const codexPane = (page: Page) => page.getByRole("button", { name: /codex/i }).first();

async function switchToShellTab(page: Page) {
  await page
    .getByRole("navigation", { name: en["space.tabStrip.title"] })
    .getByRole("button", { name: /shell/ })
    .click();
  await expect(page).toHaveURL(/\/pane\/w2(%3A|:)p2$/);
}

/** The dashboard, rendered: its address, and the pane view gone from under it. */
async function expectDashboard(page: Page) {
  await expect(page).toHaveURL(/\/$/);
  await expect(switcher(page)).toBeHidden();
  await expect(page.getByRole("main")).toBeVisible();
}

test("a pane opened cold, then another tab, backs out to the dashboard", async ({ page }) => {
  await page.goto("/pane/w2:p1");
  await expect(switcher(page)).toBeVisible();
  await switchToShellTab(page);

  await page.goBack();
  await expectDashboard(page);
});

test("a cold pane reloaded before any tap still backs out to the dashboard", async ({ page }) => {
  await page.goto("/pane/w2:p1");
  await expect(switcher(page)).toBeVisible();
  await page.reload();
  await expect(switcher(page)).toBeVisible();
  await switchToShellTab(page);

  await page.goBack();
  await expectDashboard(page);
});

test("a pane opened from a space, then another tab, backs out to that space", async ({ page }) => {
  await page.goto("/space/w2");
  await codexPane(page).click();
  await expect(switcher(page)).toBeVisible();
  await switchToShellTab(page);

  await page.goBack();
  await expect(page).toHaveURL(/\/space\/w2$/);
  await expect(switcher(page)).toBeHidden();
  await expect(codexPane(page)).toBeVisible();
});

test("a history page opened cold closes onto its pane, which backs out to the dashboard", async ({ page }) => {
  await page.goto("/pane/w2:p1/history");
  await page.getByRole("button", { name: en["history.closeAria"] }).click();
  await expect(switcher(page)).toBeVisible();

  await page.goBack();
  await expectDashboard(page);
});
