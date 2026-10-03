import { expect, test } from "@playwright/test";

test("altitude slider changes orbit impact and every numeric cell has a source badge", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await expect(page.getByTestId("eclipse-mid")).toBeVisible({ timeout: 60_000 });
  const before = await page.getByTestId("drag-mid").innerText();
  const slider = page.getByRole("slider", { name: "Altitude" });
  await slider.evaluate((element) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "800");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByTestId("drag-mid")).not.toHaveText(before, { timeout: 60_000 });
  const bare = await page.locator("[data-orbit-number]:not(:has([data-source-label]))").count();
  expect(bare).toBe(0);
  await expect(page.getByText("orbit-averaged; multi-year values use climatology (M7), not the short-term forecaster")).toBeVisible();
  await expect(page.getByTestId("binding")).toContainText("Binding limit:");
  await page.getByRole("button", { name: "Initial demo orbit" }).click();
  await expect(page.getByText("assumption; derived from Starlink CelesTrak snapshot; AI1 altitude not published.")).toBeVisible();
  await page.getByRole("checkbox", { name: "Sun-synchronous" }).check();
  await expect(page.getByRole("slider", { name: "Inclination" })).toBeDisabled();
  await page.getByRole("button", { name: "SSO dawn-dusk 06:00" }).click();
  await expect(page.getByRole("slider", { name: "LTAN" })).toHaveValue("6");
  await page.getByRole("button", { name: "SSO noon-midnight 12:00" }).click();
  await expect(page.getByRole("slider", { name: "LTAN" })).toHaveValue("12");
  await expect(page.getByRole("heading", { name: "Payload Health" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI Forecast" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Chip Spec Studio" })).toBeVisible();
});
