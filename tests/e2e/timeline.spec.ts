import { expect, test, type Page } from "@playwright/test";

async function setTimeline(page: Page, index: number) {
  await page.getByRole("slider", { name: "Timeline position" }).evaluate((element, value) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, index);
}

test("the May 2024 timeline moves the danger zones in the outlook", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/test");
  await page.getByRole("button", { name: "SSO dawn-dusk 06:00" }).click();
  await page.getByRole("button", { name: "May 2024 superstorm" }).click();
  const outlook = page.getByRole("region", { name: "Chip outlook" });
  await expect(outlook.getByText("Estimated lifetime")).toBeVisible({ timeout: 60_000 });

  // 2024-05-05 00:00, quiet.
  await setTimeline(page, 0);
  const readout = page.locator(".timeline__readout");
  await expect(readout).toContainText("2024-05-05 00:00 UTC");
  await expect(outlook.getByText("Proton event", { exact: true })).toHaveCount(0);
  const quietOval = await outlook.getByText(/Oval edge at/).innerText();

  // 2024-05-10 17:00: G3 storm and the SEP peak.
  await setTimeline(page, 137);
  await expect(readout).toContainText("2024-05-10 17:00 UTC");
  await expect(readout).toContainText("protons reach");
  await expect(outlook.getByText("Proton event", { exact: true })).toBeVisible();
  await expect(outlook.getByText(/Oval edge at/)).not.toHaveText(quietOval);
  const bare = await outlook.locator("[data-orbit-number]:not(:has([data-source-label]))").count();
  expect(bare).toBe(0);

  // The Time Machine follows the same hour.
  await page.getByRole("tab", { name: "May 2024 replay" }).click();
  await expect(page.getByRole("slider", { name: "Replay scrubber" })).toHaveValue("137");
});
