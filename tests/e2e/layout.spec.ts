import { expect, test } from "@playwright/test";

const SECTIONS: Record<string, string[]> = {
  "Orbit risk": ["Orbit Impact"],
  Chip: ["Chip Spec Studio", "Payload Health"],
  "Best orbit": ["Orbit Optimizer"],
  "Space weather": ["AI Forecast", "Best Move", "Storm Scenario"],
  "May 2024 replay": ["Time Machine"],
  Validation: ["Validation Lab"],
};

for (const width of [1280, 1920]) {
  test(`every section is reachable with no console errors at ${width} px`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Space Environment" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Chip outlook" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Orbit Location" })).toBeVisible();
    for (const [tab, headings] of Object.entries(SECTIONS)) {
      await page.getByRole("tab", { name: tab }).click();
      for (const heading of headings) {
        await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      }
    }
    expect(errors).toEqual([]);
  });
}

test("outlook numbers carry source badges and tabs work from the keyboard", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  const outlook = page.getByRole("region", { name: "Chip outlook" });
  await expect(outlook.getByText("Estimated lifetime")).toBeVisible({ timeout: 60_000 });
  const bare = await outlook.locator("[data-orbit-number]:not(:has([data-source-label]))").count();
  expect(bare).toBe(0);

  await page.getByRole("tab", { name: "Orbit risk" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Chip" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Chip" })).toBeFocused();

  const drawer = page.getByRole("complementary", { name: "Grok copilot" });
  await expect(drawer).toBeHidden();
  await page.getByRole("button", { name: "Ask copilot" }).click();
  await expect(drawer).toBeVisible();
  await page.getByRole("button", { name: "Close copilot" }).click();
  await expect(drawer).toBeHidden();
});
