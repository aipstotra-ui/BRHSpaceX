import { expect, test } from "@playwright/test";

test("altitude slider changes the on-screen result without source badges", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await expect(page.getByTestId("starmind-radius")).toBeVisible();
  const before = await page.getByTestId("starmind-radius").innerText();
  const slider = page.getByRole("slider", { name: "Altitude" });
  await slider.evaluate((element) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "800");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByTestId("starmind-radius")).not.toHaveText(before);
  expect(await page.locator("[data-source-label]").count()).toBe(0);
  await expect(page.getByLabel("Round Earth")).toBeVisible();
});
