import { expect, test, type Page } from "@playwright/test";

async function setRange(page: Page, name: string, value: number) {
  await page.getByRole("slider", { name }).evaluate((element, next) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, String(next));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

test("a case is created, edited, saved, exported to testing, and survives a reload", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/cases");
  await expect(page.getByText("No cases yet.")).toBeVisible();

  await page.getByRole("button", { name: "Create case" }).click();
  await expect(page).toHaveURL(/\/cases\/[0-9a-f]{32}$/);
  const caseUrl = page.url();
  await expect(page.getByRole("heading", { name: "New case", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Chip Spec Studio" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Orbit Location" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save case" })).toBeDisabled();

  await page.getByRole("button", { name: "Rename" }).click();
  await page.getByLabel("Case name").fill("Dawn test");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("heading", { name: "Dawn test", level: 1 })).toBeVisible();

  await setRange(page, "Altitude", 800);
  await expect(page.getByRole("button", { name: "Save case" })).toBeEnabled();
  await expect(page.getByText("Your edits are not saved yet.")).toBeVisible();
  await page.getByRole("button", { name: "Save case" }).click();
  await expect(page.getByRole("button", { name: "Save case" })).toBeDisabled();

  await page.getByRole("button", { name: "Export to testing" }).click();
  await expect(page).toHaveURL(/\/test\?case=[0-9a-f]{32}$/);
  const banner = page.getByRole("status").filter({ hasText: "Dawn test" });
  await expect(banner).toBeVisible();
  await expect(page.getByText("800 KM").first()).toBeVisible();
  const radius = page.getByTestId("starmind-radius");
  await expect(radius).toHaveAttribute("data-starmind-radius-km", String(6378.137 + 800));

  // Reload: the case comes back from the browser's storage, not from memory.
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "Dawn test" })).toBeVisible();
  await expect(page.getByTestId("starmind-radius")).toHaveAttribute("data-starmind-radius-km", String(6378.137 + 800));

  // The list shows it, with the export in its log.
  await page.goto("/cases");
  await expect(page.getByRole("link", { name: "Dawn test" })).toBeVisible();
  await page.goto(caseUrl);
  await page.getByText("Activity", { exact: true }).first().waitFor();
  await expect(page.getByText("Exported to testing.")).toBeVisible();
});

test("the testing page says so when it flies the demo, and when a case is not found", async ({ page }) => {
  await page.goto("/test");
  await expect(page.getByText("Default demo case", { exact: true })).toBeVisible();
  await page.goto("/test?case=nothing-here");
  await expect(page.getByText("That address does not name a case saved in this browser.")).toBeVisible();
  await page.goto("/cases/nothing-here");
  await expect(page.getByText("This case is not saved in this browser.")).toBeVisible();
});

test("adjusting the orbit on the testing page does not change the saved case", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/cases");
  await page.getByRole("button", { name: "Create case" }).click();
  await page.getByRole("button", { name: "Export to testing" }).click();
  await expect(page).toHaveURL(/\/test\?case=/);
  await page.getByText("Adjust orbit for this test").click();
  await setRange(page, "Altitude", 900);
  await expect(page.getByText("This page differs from the saved case.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("This page differs from the saved case.")).toHaveCount(0);
});

test("the nav reaches cases and testing, and the mark has an accessible home link", async ({ page }) => {
  await page.goto("/cases");
  await expect(page.getByRole("link", { name: "3rok, home" })).toHaveAttribute("href", "/");
  await expect(page.getByRole("link", { name: "Cases" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Testing" }).click();
  await expect(page).toHaveURL(/\/test$/);
  await expect(page.getByRole("link", { name: "Testing" })).toHaveAttribute("aria-current", "page");
});
