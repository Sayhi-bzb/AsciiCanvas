import { expect, test } from "@playwright/test";

test("lets source panels grow beyond their baseline without vertical scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1728, height: 900 });
  await page.goto("./#type-flowchart");
  await expect(page.locator("main article")).toHaveCount(3);

  const shortSource = page
    .locator("#flowchart")
    .locator('[data-slot="example-source"]');
  await expect.poll(() =>
    shortSource.evaluate((element) => element.clientHeight)
  ).toBe(288);

  await page.goto("./#type-er");
  await expect(page.locator("main article")).toHaveCount(3);
  const longSource = page
    .locator("#er-advanced")
    .locator('[data-slot="example-source"]');
  const desktopGeometry = await longSource.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));

  expect(desktopGeometry.clientHeight).toBeGreaterThan(288);
  expect(desktopGeometry.scrollHeight).toBeLessThanOrEqual(
    desktopGeometry.clientHeight + 1
  );

  await page.setViewportSize({ width: 390, height: 600 });
  await page.goto("./#type-markdown-basics");
  await expect(page.locator("main article")).toHaveCount(3);
  const wideSource = page
    .locator("#markdown-basics")
    .locator('[data-slot="example-source"]');
  const mobileGeometry = await wideSource.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(mobileGeometry.scrollWidth).toBeGreaterThan(mobileGeometry.clientWidth);
});
