import { expect, test, type Page } from "@playwright/test";

/** The slider moves in whole minutes of UTC time. */
async function setTimeline(page: Page, iso: string) {
  const index = Math.floor(Date.parse(iso) / 60_000);
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
  await page.getByText("Adjust orbit for this test").click();
  await page.getByRole("button", { name: "SSO dawn-dusk 06:00" }).click();
  await page.getByRole("button", { name: "May 2024 superstorm" }).click();
  const outlook = page.getByRole("region", { name: "Chip outlook" });
  await expect(outlook.getByText("Estimated lifetime")).toBeVisible({ timeout: 60_000 });

  // 2024-05-05 00:00, quiet.
  await setTimeline(page, "2024-05-05T00:00:00Z");
  const readout = page.locator(".timeline__readout");
  await expect(readout).toContainText("2024-05-05 00:00 UTC");
  await expect(outlook.getByText("Proton event", { exact: true })).toHaveCount(0);
  const quietOval = await outlook.getByText(/Oval edge at/).innerText();

  // 2024-05-10 17:00: G3 storm and the SEP peak.
  await setTimeline(page, "2024-05-10T17:00:00Z");
  await expect(readout).toContainText("2024-05-10 17:00 UTC");
  await expect(readout).toContainText("protons reach");
  await expect(outlook.getByText("Proton event", { exact: true })).toBeVisible();
  await expect(outlook.getByText(/Oval edge at/)).not.toHaveText(quietOval);
  const bare = await outlook.locator("[data-orbit-number]:not(:has([data-source-label]))").count();
  expect(bare).toBe(0);

  // Kp 9 on 11 May: the chip ages faster, the AI shows its earlier call, and life is used up.
  await setTimeline(page, "2024-05-05T00:00:00Z");
  const lifeBefore = Number((await outlook.getByTestId("life-left").innerText()).split(/\s/)[0]);
  await setTimeline(page, "2024-05-11T02:00:00Z");
  await expect(outlook.getByTestId("aging")).toContainText("faster");
  const ai = page.getByRole("region", { name: "AI analysis" });
  await expect(ai).toContainText("For this 3-hour block the AI predicted Kp");
  await expect(ai).toContainText("How it did in May 2024");
  await expect(ai.getByText(/% confident/)).toBeVisible({ timeout: 30_000 });
  await setTimeline(page, "2024-05-16T23:00:00Z");
  await expect(outlook.getByTestId("aging")).toContainText("extra days");
  const lifeAfter = Number((await outlook.getByTestId("life-left").innerText()).split(/\s/)[0]);
  expect(lifeAfter).toBeLessThan(lifeBefore);
  await setTimeline(page, "2024-05-10T17:00:00Z");

  // The Time Machine follows the same hour.
  await page.getByRole("tab", { name: "May 2024 replay" }).click();
  await expect(page.getByRole("slider", { name: "Replay scrubber" })).toHaveValue("137");
  await expect(page.getByText(/The AI policy (cut|raised) the storm cost/)).toBeVisible({ timeout: 60_000 });
});
