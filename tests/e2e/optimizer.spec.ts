import { expect, test } from "@playwright/test";

test("Move Starmind to best orbit updates the orbit", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  const best = page.getByTestId("best-altitude");
  await expect(best).toBeVisible();
  const target = await best.getAttribute("data-best-altitude-km");
  await page.getByRole("button", { name: "Move Starmind to best orbit" }).click();
  await expect(page.getByTestId("starmind-radius")).toContainText(`${Number(target).toFixed(3)} km`);
  await expect(page.getByTestId("hohmann-label")).toContainText("ILLUSTRATIVE");
  await expect(page.getByText("not the short-term forecaster")).toBeVisible();
});
