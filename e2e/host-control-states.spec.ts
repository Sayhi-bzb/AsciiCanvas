import { expect, test, type Locator, type Page } from "@playwright/test";

const STORAGE_KEY = "ascii-canvas-persistence";

const readHoverStyle = async (control: Locator) => {
  await control.hover();
  await control.page().waitForTimeout(250);
  return control.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
    };
  });
};

const seedHostState = async (
  page: Page,
  viewport: { width: number; height: number },
  dark: boolean
) => {
  const offset = viewport.width < 600 ? { x: 80, y: 100 } : { x: 180, y: 130 };
  await page.setViewportSize(viewport);
  await page.goto("/");
  await page.evaluate(
    ({ storageKey, offset }) => {
      const sessions = [
        {
          id: "host-a",
          name: "Alpha",
          mode: "freeform",
          scene: [],
          grid: [
            ["0,0", { char: "A", color: "#111827" }],
            ["1,0", { char: "B", color: "#111827" }],
          ],
          viewport: { offset, zoom: 1 },
        },
        {
          id: "host-b",
          name: "Beta",
          mode: "freeform",
          scene: [],
          grid: [],
          viewport: { offset, zoom: 1 },
        },
        {
          id: "host-c",
          name: "Gamma",
          mode: "freeform",
          scene: [],
          grid: [],
          viewport: { offset, zoom: 1 },
        },
      ];
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          state: {
            offset,
            zoom: 1,
            canvasMode: "freeform",
            structuredScene: [],
            structuredComponents: [],
            canvasBounds: null,
            animationTimeline: null,
            brushChar: "#",
            brushColor: "#111827",
            showGrid: true,
            exportShowGrid: false,
            canvasSessions: sessions,
            activeCanvasId: "host-a",
            grid: sessions[0].grid,
          },
          version: 0,
        })
      );
    },
    { storageKey: STORAGE_KEY, offset }
  );
  await page.reload();
  await page.evaluate((useDarkTheme) => {
    document.documentElement.classList.toggle("dark", useDarkTheme);
  }, dark);

  const surface = page.getByTestId("ascii-canvas-surface");
  const box = await surface.boundingBox();
  expect(box).not.toBeNull();
  await page.getByRole("button", { name: "Select" }).click();
  await page.mouse.move(box!.x + offset.x + 2, box!.y + offset.y + 8);
  await page.mouse.down();
  await page.mouse.move(box!.x + offset.x + 15, box!.y + offset.y + 8, {
    steps: 3,
  });
  await page.mouse.up();

  return { surface };
};

for (const scenario of [
  { name: "desktop light", viewport: { width: 1440, height: 900 }, dark: false },
  { name: "desktop dark", viewport: { width: 1440, height: 900 }, dark: true },
  { name: "mobile light", viewport: { width: 390, height: 844 }, dark: false },
  { name: "mobile dark", viewport: { width: 390, height: 844 }, dark: true },
]) {
  test(`Host controls match Selection Toolbar hover in ${scenario.name}`, async ({
    page,
  }, testInfo) => {
    await seedHostState(page, scenario.viewport, scenario.dark);

    const selectionControl = page.getByRole("button", {
      name: "Toggle bold",
    });
    await expect(selectionControl).toBeVisible();
    const expectedHover = await readHoverStyle(selectionControl);
    expect(expectedHover.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");

    const dockControl = page.getByRole("button", { name: "Box" });
    await expect(readHoverStyle(dockControl)).resolves.toEqual(expectedHover);

    const activeDockItem = page.locator('[data-toolbar-item="select"]');
    const dockItem = page.locator('[data-toolbar-item="shape-group"]');
    const adjacentDockItem = page.locator('[data-toolbar-item="bg"]');
    const submenuTrigger = dockItem.locator(
      '[data-toolbar-submenu-trigger="true"]'
    );
    const activeDockBackground = await activeDockItem.evaluate(
      (element) => window.getComputedStyle(element).backgroundColor
    );
    await submenuTrigger.hover();
    await expect(dockItem).toHaveCSS("background-color", activeDockBackground);
    await expect(dockControl).toHaveCSS(
      "color",
      await activeDockItem
        .getByRole("button", { name: "Select" })
        .evaluate((element) => window.getComputedStyle(element).color)
    );
    await expect(adjacentDockItem).not.toHaveCSS(
      "background-color",
      activeDockBackground
    );
    await expect(submenuTrigger).toHaveCSS("border-left-width", "0px");

    const railOrientation =
      scenario.viewport.width < 600 ? "horizontal" : "vertical";
    if (railOrientation === "horizontal") {
      await page.getByRole("button", { name: "Open library" }).click();
    }
    const sidebarControl = page
      .getByTestId(`character-view-rail-${railOrientation}`)
      .getByRole("tab", { name: "Nerd Icons" });
    await expect(readHoverStyle(sidebarControl)).resolves.toEqual(expectedHover);
    if (railOrientation === "horizontal") {
      await page.keyboard.press("Escape");
    }

    const sessionShell = page.locator('[data-session-tabs-shell="true"]');
    await sessionShell.hover();
    const sessionControl = page.getByRole("tab", { name: "Beta" });
    await expect(sessionControl).toBeVisible();
    await expect(readHoverStyle(sessionControl)).resolves.toEqual(expectedHover);

    const activeSessionItem = page.locator(
      '[data-session-tab-item="host-a"]'
    );
    const sessionItem = page.locator('[data-session-tab-item="host-b"]');
    const adjacentSessionItem = page.locator(
      '[data-session-tab-item="host-c"]'
    );
    const closeControl = sessionItem.locator('[data-session-close="true"]');
    const activeSessionBackground = await activeSessionItem.evaluate(
      (element) => window.getComputedStyle(element).backgroundColor
    );
    const activeSessionColor = await activeSessionItem
      .getByRole("tab")
      .evaluate((element) => window.getComputedStyle(element).color);
    await closeControl.hover();
    await expect(sessionItem).toHaveCSS(
      "background-color",
      activeSessionBackground
    );
    await expect(sessionControl).toHaveCSS("color", activeSessionColor);
    await expect(adjacentSessionItem).not.toHaveCSS(
      "background-color",
      activeSessionBackground
    );

    await page.screenshot({
      path: testInfo.outputPath(`host-controls-${scenario.name.replace(" ", "-")}.png`),
      fullPage: true,
    });
  });
}
