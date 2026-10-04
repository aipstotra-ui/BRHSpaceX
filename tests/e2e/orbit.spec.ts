import { expect, test } from "@playwright/test";

test("the judge page shows the Earth, a safety score, and an orbit control", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ask StarMind" })).toBeVisible();
  await expect(page.getByTestId("safety-score")).toBeVisible();
  await expect(page.getByLabel("Round Earth")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("slider", { name: "Altitude" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Find the safest orbit" })).toBeVisible();
});
