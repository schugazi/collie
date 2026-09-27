import { expect, test } from "@playwright/test";

import { en } from "@/lib/i18n/messages/en";

import { installApiStub } from "./fixtures/api";

// THE COMPOSER'S BELT, measured in a real engine. The belt (`components/actions-row.tsx`) is two
// 40px rows — Collie's controls, then the harness's commands — beside a Switch cell as tall as both.
// Two of its promises are geometry no unit test can see, and one of them was broken in Safari alone:
//
//  * A row scrolls sideways ONLY. On 2026-09-14 the belt's harness section reached 6px past the
//    band with a negative margin, and the pills' tap box reached 7px further still. Chromium clipped
//    the overflow; WebKit counted it as scrollable and let a thumb nudge the belt up. The fix made
//    every box inside a row fit the band, and this case is the guard: `scrollHeight` equals
//    `clientHeight`, and a `scrollTop` written by hand reads back as 0.
//  * Every pill is visible at rest. The operator asked for two rows so nothing needs a sideways
//    scroll, so at a phone's width neither row overflows and each row's last pill stops LEFT of the
//    Switch cell. The fixture pane is Claude's, whose row is the widest.
//  * Nothing bare is left on the belt: the pills spread over their rows up to the Switch cell, the
//    harness section's tint runs from the screen edge to the cell's hairline, and the harness mark
//    keeps enough tint to itself to read as the row's label.
//
// Runs under every `app-*` project, so Chromium and WebKit answer the same questions.

test.beforeEach(async ({ page }) => {
  await installApiStub(page);
});

const BELT = '[data-slot="composer-actions"]';
const ROWS = `${BELT} [data-overflow] > div > div`;

test("each belt row scrolls sideways only, in this engine too", async ({ page }) => {
  await page.goto("/pane/w1:p1");
  await expect(page.getByRole("button", { name: en["chat.switcher.aria"] })).toBeVisible();

  const rows = await page.locator(ROWS).evaluateAll((els) =>
    els.map((el) => {
      el.scrollTop = 20;
      return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, scrollTop: el.scrollTop };
    }),
  );
  expect(rows).toHaveLength(2);
  for (const row of rows) {
    expect(row.scrollHeight).toBe(row.clientHeight);
    expect(row.scrollTop).toBe(0);
  }
});

test("both rows show every pill without scrolling, left of the Switch cell", async ({ page }) => {
  await page.goto("/pane/w1:p1");
  const switchButton = page.getByRole("button", { name: en["chat.switcher.aria"] });
  await expect(switchButton).toBeVisible();

  const rows = await page.locator(ROWS).evaluateAll((els) =>
    els.map((el) => {
      const pills = el.querySelectorAll("button");
      const last = pills[pills.length - 1];
      return {
        overflows: el.scrollWidth > el.clientWidth + 1,
        lastRight: last?.getBoundingClientRect().right ?? NaN,
      };
    }),
  );
  const switchLeft = (await switchButton.boundingBox())?.x ?? NaN;
  expect(rows).toHaveLength(2);
  for (const row of rows) {
    expect(row.overflows).toBe(false);
    expect(row.lastRight).toBeLessThanOrEqual(switchLeft);
  }
});

// ONE SCALE FOR THE WHOLE BELT (operator, 2026-09-23). The Settings row "Action belt size" stores
// `beltScale` in the dash prefs; the belt's root carries it as `--belt-scale`, and index.css derives
// each row's band, the pills and the icons from it. Measured at 375x812 in Chromium: a row, a pill
// and its icon at each of the three sizes, and every pill answering its whole row.
test.describe("the belt's size setting", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  const SIZES = [
    { scale: 1.15, band: 45, pill: 37, icon: 18 },
    { scale: 1.3, band: 52, pill: 42, icon: 21 },
    { scale: 1.5, band: 60, pill: 48, icon: 24 },
  ] as const;

  for (const size of SIZES) {
    test(`at scale ${size.scale} a row is ${size.band}px, a pill ${size.pill}px, an icon ${size.icon}px`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "app-phone", "measured once, in Chromium at phone width");
      await page.addInitScript((beltScale) => {
        localStorage.setItem("collie:dash-prefs:v1", JSON.stringify({ beltScale }));
      }, size.scale);
      await page.goto("/pane/w1:p1");
      await expect(page.getByRole("button", { name: en["chat.switcher.aria"] })).toBeVisible();

      const m = await page.locator(ROWS).first().evaluate((el) => {
        const pill = el.querySelector("button")!;
        const icon = pill.querySelector("svg")!;
        const band = el.getBoundingClientRect();
        const p = pill.getBoundingClientRect();
        const i = icon.getBoundingClientRect();
        // The pill's hit box reaches the row's own edges: a probe 1px inside the row's top and
        // bottom, over the pill's middle, lands on the pill.
        const x = p.left + p.width / 2;
        const hit = (y: number) => pill.contains(document.elementFromPoint(x, y));
        return {
          band: band.height,
          pill: p.height,
          icon: [i.width, i.height],
          top: hit(band.top + 1),
          bottom: hit(band.bottom - 1),
          scroll: [el.scrollHeight, el.clientHeight],
        };
      });
      expect(m.band).toBe(size.band);
      expect(m.pill).toBe(size.pill);
      expect(m.icon).toEqual([size.icon, size.icon]);
      expect(m.top).toBe(true);
      expect(m.bottom).toBe(true);
      expect(m.scroll[0]).toBe(m.scroll[1]);
    });
  }
});

test("a portrait cover display keeps its focused composer when the keyboard shrinks the viewport", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("collie:zen-enabled:v1", "1");
    localStorage.setItem("collie:auto-zen-enabled:v1", "1");
    // Only the viewport shrinks on keyboard opening; the device never rotates.
    Object.defineProperty(screen, "orientation", {
      configurable: true,
      value: { type: "portrait-primary", addEventListener() {}, removeEventListener() {} },
    });
  });
  await page.setViewportSize({ width: 430, height: 900 });
  await page.goto("/pane/w1:p1");
  const box = page.getByRole("textbox", { name: en["composer.placeholder.reply"] });
  await box.focus();

  await page.setViewportSize({ width: 430, height: 360 });

  expect(await page.evaluate(() => matchMedia("(orientation: landscape)").matches)).toBe(true);
  await expect(box).toBeVisible();
  await expect(box).toBeFocused();
  await expect(page.getByRole("button", { name: "Exit zen mode" })).toHaveCount(0);
});

test("no bare belt: the pills spread to the Switch cell, the tint spans its row, the mark stands apart", async ({ page }) => {
  // The operator, from the phone: no empty belt between the rows and the Switch cell, the harness
  // tint from one end of its row to the other, the buttons spread over the whole width rather than
  // bunched at the left, and the harness mark far enough from Model to read as a label.
  await page.goto("/pane/w1:p1");
  const switchButton = page.getByRole("button", { name: en["chat.switcher.aria"] });
  await expect(switchButton).toBeVisible();

  const cell = await switchButton.evaluate((el) => {
    const r = el.parentElement!.getBoundingClientRect();
    return { left: r.left, width: r.width };
  });
  const beltLeft = await page.locator(BELT).evaluate((el) => el.getBoundingClientRect().left);
  const rows = await page.locator(ROWS).evaluateAll((els) =>
    els.map((el) => {
      const pills = el.querySelectorAll("button");
      return { right: el.getBoundingClientRect().right, lastPillRight: pills[pills.length - 1]!.getBoundingClientRect().right };
    }),
  );
  const harness = page.getByRole("group", { name: en["harnessBar.label"] });
  const section = await harness.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, markRight: el.querySelector("svg")!.getBoundingClientRect().right };
  });
  const modelLeft = await page
    .getByRole("button", { name: en["harnessBar.model"] })
    .evaluate((el) => el.getBoundingClientRect().left);

  expect(cell.width).toBeGreaterThanOrEqual(32);
  expect(cell.width).toBeLessThanOrEqual(44);
  for (const row of rows) {
    expect(Math.abs(row.right - cell.left)).toBeLessThanOrEqual(1);
    // The last pill ends at the row's own few px of gutter, not after a run of empty belt.
    expect(cell.left - row.lastPillRight).toBeLessThanOrEqual(6);
  }
  expect(Math.abs(section.left - beltLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs(section.right - cell.left)).toBeLessThanOrEqual(1);
  expect(modelLeft - section.markRight).toBeGreaterThanOrEqual(12);
});