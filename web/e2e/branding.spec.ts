import { expect, test } from "@playwright/test";
import { installApiStub } from "./fixtures/api";

test("the installed app and phone header use mycroftxxx remote branding", async ({ page, request }) => {
  await installApiStub(page);
  await page.goto("/");
  await expect(page).toHaveTitle("mycroftxxx remote");
  await expect(page.getByRole("button", { name: "mycroftxxx remote home", exact: true })).toBeVisible();
  const name = page.getByText("mycroftxxx remote", { exact: true });
  await expect(name).toBeVisible();
  expect(await name.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.name).toBe("mycroftxxx remote");
  expect(manifest.short_name).toBe("mycroftxxx");
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
  await expect(page.getByText("Collie", { exact: true })).toHaveCount(0);
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "mycroftxxx");
});
