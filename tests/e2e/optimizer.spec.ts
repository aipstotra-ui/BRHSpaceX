import { expect, test } from "@playwright/test";

test("Move Starmind to best orbit updates the orbit", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByRole("tab", { name: "Best orbit" }).click();
  const best = page.getByTestId("best-altitude");
  await expect(best).toBeVisible();
  const target = await best.getAttribute("data-best-altitude-km");
  await page.getByRole("button", { name: "Move Starmind to best orbit" }).click();
  await expect(page.getByTestId("starmind-radius")).toContainText(`${Number(target).toFixed(3)} km`);
  await expect(page.getByTestId("hohmann-label")).toContainText("ILLUSTRATIVE");
  const optimizer = page.getByRole("region", { name: "Orbit Optimizer" });
  await expect(optimizer.getByText("not the short-term forecaster")).toBeVisible();
});
