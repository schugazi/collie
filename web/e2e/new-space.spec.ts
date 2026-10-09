import { expect, test } from "@playwright/test";
import { en } from "@/lib/i18n/messages/en";
import { fixtureNewSpace } from "@/test/handlers";
import { installApiStub } from "./fixtures/api";

// The fork's Home folders list on the New page: the machine's visible immediate home subdirectories,
// from `/api/launchers`' `directories`, offered under Favourites and Recent. A tap fills the field;
// Start then creates the space there. The stub's launchers answer has no agent list, as a bridge
// before 1.19.0, so Start with Shell goes through the plain space create.

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("states"), "the playground has no dashboard route");
  await installApiStub(page);
});

test("a home folder fills the field and the new space starts there", async ({ page }) => {
  const directory = "/home/you/webapp";
  await page.route("**/api/launchers", route => route.fulfill({
    json: { launchers: [], home: "/home/you", directories: [directory] },
  }));
  await page.goto("/");
  await page.getByRole("button", { name: en["space.overview.new.aria"] }).click();
  const list = page.getByRole("list", { name: en["space.new.folders.home"] });
  // Folded until its title is tapped.
  const toggle = page.getByRole("button", { name: en["space.new.folders.home"] });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(list).toHaveCount(0);
  await toggle.click();
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await list.getByRole("listitem").getByRole("button").first().click();
  await expect(page.getByPlaceholder(en["space.new.dir.placeholder"])).toHaveValue(directory);
  const submitted = page.waitForRequest(req => new URL(req.url()).pathname === "/api/workspace" && req.method() === "POST");
  await page.getByRole("button", { name: en["newPage.start"] }).click();
  expect((await submitted).postDataJSON()).toEqual({ cwd: directory });
  await expect(page).toHaveURL(new RegExp(`/pane/${encodeURIComponent(fixtureNewSpace.pane.paneId)}$`, "u"));
});
