import { expect, test } from "@playwright/test";

test("altitude slider updates the Starmind orbit radius", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/test");
  const radius = page.getByTestId("starmind-radius");
  await expect(radius).toBeVisible();
  await expect(radius).toContainText("SSO (official). Altitude");
  await expect(radius).toContainText("= assumption. FCC filing range 500–2,000 km.");
  const before = await radius.getAttribute("data-starmind-radius-km");
  const slider = page.getByRole("slider", { name: "Altitude" });
  await slider.evaluate((element) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "800");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(radius).not.toHaveAttribute("data-starmind-radius-km", before ?? "");
  const after = Number(await radius.getAttribute("data-starmind-radius-km"));
  expect(after).toBeGreaterThan(Number(before));
});
