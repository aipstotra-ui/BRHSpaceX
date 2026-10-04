import { expect, test } from "@playwright/test";

const outDir = "/opt/cursor/artifacts";

test("capture globe normal, follow, and 2D fallback", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  const state = page.getByTestId("globe-scene-state");
  await expect(state).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${outDir}/globe-normal.png`, fullPage: false });
  await page.getByRole("button", { name: "Follow Starmind" }).click();
  await expect(state).toHaveAttribute("data-follow", "true");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${outDir}/globe-follow.png`, fullPage: false });
  const switched = await state.getAttribute("data-mode");
  if (switched !== "2d") {
    await page.waitForTimeout(9000);
  }
  if ((await state.getAttribute("data-mode")) !== "2d") {
    await page.getByRole("button", { name: "Ground track" }).click();
  }
  await expect(state).toHaveAttribute("data-mode", "2d", { timeout: 20_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}/globe-2d.png`, fullPage: false });
  const fps = await state.getAttribute("data-median-fps");
  const workerMs = await state.getAttribute("data-worker-ms");
  console.log("GLOBE_MEDIAN_FPS", fps);
  console.log("GLOBE_WORKER_MS", workerMs);
  console.log("GLOBE_MODE", await state.getAttribute("data-mode"));
  console.log("GLOBE_PROPAGATOR", await state.getAttribute("data-propagator"));
});
