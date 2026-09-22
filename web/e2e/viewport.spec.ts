import { expect, test } from "@playwright/test";
import { en } from "@/lib/i18n/messages/en";
import { installApiStub } from "./fixtures/api";

test.use({ serviceWorkers: "block", isMobile: true });

test.beforeEach(async ({ page }) => {
  await installApiStub(page);
});

for (const path of ["/", "/settings", "/pane/w1:p1"]) {
  test(`the document stays inside the viewport on ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(path.startsWith("/pane/")
      ? page.getByRole("button", { name: en["chat.switcher.aria"] })
      : page.getByRole("main")).toBeVisible();
    const shell = await page.evaluate(() => {
      window.scrollTo(100, 100);
      return {
        x: window.scrollX, y: window.scrollY,
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
        touch: getComputedStyle(document.body).touchAction,
        overscroll: getComputedStyle(document.documentElement).overscrollBehavior,
      };
    });
    expect(shell.x).toBe(0);
    expect(shell.y).toBe(0);
    expect(shell.width).toBeLessThanOrEqual(shell.viewportWidth);
    expect(shell.height).toBeLessThanOrEqual(shell.viewportHeight);
    expect(shell.touch).toBe("pan-x pan-y");
    expect(shell.overscroll).toBe("auto none");
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /maximum-scale=1, user-scalable=no/);
  });
}

test("settings still scrolls inside the fixed shell", async ({ page }) => {
  await page.goto("/settings");
  const main = page.getByRole("main");
  await expect(main).toBeVisible();
  const scroll = await main.evaluate(el => {
    el.scrollTop = el.scrollHeight;
    return { top: el.scrollTop, max: el.scrollHeight - el.clientHeight };
  });
  expect(scroll.max).toBeGreaterThan(0);
  expect(scroll.top).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("touch pinch keeps the page at its original scale", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "CDP touch input is Chromium-only");
  await page.goto("/settings");
  await expect(page.getByRole("main")).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [
    { x: 175, y: 300, id: 0 }, { x: 215, y: 300, id: 1 },
  ] });
  for (let delta = 10; delta <= 100; delta += 10) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [
      { x: 175 - delta, y: 300, id: 0 }, { x: 215 + delta, y: 300, id: 1 },
    ] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1);
  await cdp.detach();
});

test("browser history does not replay the app slide", async ({ page }) => {
  await page.goto("/pane/w1:p1");
  await page.getByRole("button", { name: en["nav.home.aria.default"], exact: true }).click();
  await expect(page.getByRole("main")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("button", { name: en["chat.switcher.aria"] })).toBeVisible();
  await expect(page.locator('[data-slot="screen-transition"]')).toHaveCSS("animation-name", "none");
  await page.goForward();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.locator('[data-slot="screen-transition"]')).toHaveCSS("animation-name", "none");
});
