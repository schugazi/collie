import { expect, test } from "@playwright/test";
import { en } from "@/lib/i18n/messages/en";
import { fixtureAgents } from "@/test/handlers";
import { installApiStub } from "./fixtures/api";

test.use({ serviceWorkers: "block" });

test("a new workspace starts in the directory selected from the dropdown", async ({ page }) => {
  await installApiStub(page);
  const pane = fixtureAgents[0]!;
  const directory = pane.cwd;
  await page.route("**/api/launchers", route => route.fulfill({
    json: { launchers: [], home: "/home/you", directories: [directory] },
  }));
  await page.route("**/api/workspace", route => route.fulfill({
    json: { ok: true, pane: { paneId: pane.paneId, workspaceId: pane.workspaceId,
      workspaceLabel: pane.workspaceLabel, tabId: pane.tabId, cwd: directory } },
  }));
  await page.goto("/");
  await page.getByRole("button", { name: en["space.overview.new.aria"], exact: true }).click();
  const sheet = page.getByRole("dialog", { name: en["space.new.title"] });
  const picker = sheet.getByRole("combobox", { name: en["space.new.dir.label"] });
  await expect(picker.getByRole("option", { name: "~/webapp" })).toBeAttached();
  await picker.selectOption(directory);
  await expect(picker).toHaveValue(directory);
  const box = await picker.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  const submitted = page.waitForRequest(req => req.url().endsWith("/api/workspace") && req.method() === "POST");
  await sheet.getByRole("button", { name: en["space.new.create"] }).click();
  expect((await submitted).postDataJSON()).toEqual({ cwd: directory });
  await expect(page.getByRole("button", { name: en["chat.switcher.aria"] })).toBeVisible();
});
