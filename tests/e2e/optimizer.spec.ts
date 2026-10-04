import { expect, test } from "@playwright/test";

test("Move to this orbit updates the orbit on screen", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  const best = page.getByTestId("best-altitude");
  await expect(best).toBeVisible();
  const target = Number(await best.getAttribute("data-best-altitude-km"));
  await page.getByRole("button", { name: "Move to this orbit" }).click();
  await expect(page.getByTestId("starmind-radius")).toContainText(`${target.toFixed(0)} km`);
  await expect(page.getByLabel("Round Earth")).toBeVisible();
});
