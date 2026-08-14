import { expect, test } from "@playwright/test";

const slideDeck = [
  "---",
  "chardesk: slides/v1",
  "title: Inspector layout",
  "---",
  "## Slide 1",
  "```text size=12x4",
  "Inspector",
  "```",
].join("\n");

for (const scenario of [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "phone", viewport: { width: 390, height: 844 } },
  { name: "Slides desktop", viewport: { width: 1440, height: 900 }, slides: true },
  { name: "Slides phone", viewport: { width: 390, height: 844 }, slides: true },
]) {
  test(`Inspector content stays inside its viewer on ${scenario.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(scenario.viewport);
    await page.goto("/");

    if (scenario.slides) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.locator('input[type="file"]').setInputFiles({
        name: "inspector-layout.slides.md",
        mimeType: "text/markdown",
        buffer: Buffer.from(slideDeck),
      });
      await expect(page.getByRole("button", { name: "Select canvas" })).toContainText(
        "Inspector layout"
      );
      await page.keyboard.press("Escape");
    }

    const panel = page.getByTestId("canvas-inspector-panel");
    const toggle = page.getByRole("button", { name: "Toggle inspector" });
    await expect(toggle).toBeVisible();
    if (scenario.viewport.width < 600) {
      await expect(panel).toBeHidden();
      await toggle.click();
    }
    await expect(panel).toBeVisible();

    const geometry = await panel.evaluate((element) => {
      const content = element.querySelector<HTMLElement>(
        '[data-testid="canvas-inspector-content"]'
      );
      const picker = element.querySelector<HTMLElement>(
        '[data-color-picker-panel="true"]'
      );
      const header = element.querySelector<HTMLElement>(
        '[data-testid="color-picker-header"]'
      );
      const restore = element.querySelector<HTMLElement>(
        'button[aria-label="Restore default color"]'
      );

      if (!content || !picker || !header || !restore) {
        throw new Error("Inspector layout fixture is incomplete");
      }

      const panelRect = element.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const restoreRect = restore.getBoundingClientRect();

      return {
        panelClientWidth: element.clientWidth,
        panelScrollWidth: element.scrollWidth,
        pickerClientWidth: picker.clientWidth,
        pickerScrollWidth: picker.scrollWidth,
        headerClientWidth: header.clientWidth,
        headerScrollWidth: header.scrollWidth,
        restoreRight: restoreRect.right,
        contentRight: contentRect.right,
        panelRight: panelRect.right,
      };
    });

    expect(geometry.panelScrollWidth).toBeLessThanOrEqual(
      geometry.panelClientWidth
    );
    expect(geometry.pickerScrollWidth).toBeLessThanOrEqual(
      geometry.pickerClientWidth
    );
    expect(geometry.headerScrollWidth).toBeLessThanOrEqual(
      geometry.headerClientWidth
    );
    expect(geometry.restoreRight).toBeLessThanOrEqual(geometry.contentRight);
    expect(geometry.restoreRight).toBeLessThanOrEqual(geometry.panelRight);
  });
}
