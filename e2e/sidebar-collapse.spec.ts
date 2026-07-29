import { expect, test } from "@playwright/test";

test.describe("Sidebar collapse", () => {
  test("uses a standalone trigger and expands continuously from the right", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const sidebar = page.locator('[data-slot="sidebar"]');
    const container = page.locator('[data-slot="sidebar-container"]');
    const inner = page.locator('[data-slot="sidebar-inner"]');
    const content = page.locator('[data-slot="sidebar-content"]');
    const trigger = page.getByRole("button", { name: "Toggle Sidebar" });

    await expect(sidebar).toHaveAttribute("data-state", "expanded");
    await expect(page.locator('[data-slot="sidebar-footer"]')).toHaveCount(0);
    const expandedBox = await container.boundingBox();
    const expandedTriggerBox = await trigger.boundingBox();
    expect(expandedBox).not.toBeNull();
    expect(expandedTriggerBox).not.toBeNull();
    await expect(container).toHaveCSS("transition-duration", "0.28s");
    await expect(container).toHaveCSS(
      "transition-timing-function",
      "cubic-bezier(0.22, 1, 0.36, 1)"
    );

    await trigger.click();
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");
    await expect(sidebar).toHaveAttribute(
      "data-collapsed-appearance",
      "trigger"
    );
    await expect(content).toHaveAttribute("aria-hidden", "true");
    await expect(content).toHaveAttribute("inert", "");
    await expect(inner).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(container).toHaveCSS("pointer-events", "none");
    await expect(trigger).toHaveCSS("pointer-events", "auto");
    await expect(sidebar.getByRole("button")).toHaveCount(1);
    await expect(sidebar.getByRole("tab")).toHaveCount(0);
    await page.waitForTimeout(350);

    const collapsedBox = await container.boundingBox();
    const collapsedTriggerBox = await trigger.boundingBox();
    expect(collapsedBox).not.toBeNull();
    expect(collapsedTriggerBox).not.toBeNull();
    expect(collapsedBox!.width).toBeLessThan(expandedBox!.width);
    expect(Math.abs(collapsedTriggerBox!.x - expandedTriggerBox!.x)).toBeLessThanOrEqual(1);

    await trigger.click();
    await page.waitForTimeout(80);
    const intermediateBox = await container.boundingBox();
    expect(intermediateBox).not.toBeNull();
    expect(intermediateBox!.width).toBeGreaterThan(collapsedBox!.width);
    expect(intermediateBox!.width).toBeLessThan(expandedBox!.width);

    await expect(sidebar).toHaveAttribute("data-state", "expanded");
    await page.waitForTimeout(260);
    await expect(page.getByRole("tab", { name: "Essentials" })).toBeVisible();
    const reopenedBox = await container.boundingBox();
    const reopenedTriggerBox = await trigger.boundingBox();
    expect(reopenedBox).not.toBeNull();
    expect(reopenedTriggerBox).not.toBeNull();
    expect(Math.abs(reopenedBox!.width - expandedBox!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(reopenedTriggerBox!.x - expandedTriggerBox!.x)).toBeLessThanOrEqual(1);

    await page.screenshot({
      path: testInfo.outputPath("sidebar-expanded.png"),
      fullPage: true,
    });
  });

  test("keeps the mobile sheet behavior without a footer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await page.getByRole("button", { name: "Open library" }).click();
    await expect(page.getByRole("tab", { name: "Essentials" })).toBeVisible();
    await expect(page.locator('[data-slot="sidebar-footer"]')).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tab", { name: "Essentials" })).not.toBeVisible();
  });

  test("respects reduced motion", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const sidebar = page.locator('[data-slot="sidebar"]');
    const container = page.locator('[data-slot="sidebar-container"]');
    await expect(container).toHaveCSS("transition-property", "none");

    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");
    await expect(container).toHaveCSS("transition-property", "none");
  });
});
