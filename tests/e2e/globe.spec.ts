import { expect, test } from "@playwright/test";

test("altitude slider updates the starmind orbit radius in scene state", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  const state = page.getByTestId("globe-scene-state");
  await expect(state).toBeVisible({ timeout: 60_000 });
  const slider = page.getByRole("slider", { name: "Altitude" });
  await expect(slider).toBeVisible();
  await slider.evaluate((element) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "800");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(state).toHaveAttribute("data-altitude-km", "800");
  const radius = Number(await state.getAttribute("data-orbit-radius-km"));
  expect(radius).toBeCloseTo(6378.137 + 800, 2);
});
