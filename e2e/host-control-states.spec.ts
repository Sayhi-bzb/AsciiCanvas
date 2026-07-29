import { expect, test, type Locator, type Page } from "@playwright/test";

const STORAGE_KEY = "ascii-canvas-persistence";

const readHoverStyle = async (control: Locator) => {
  await control.hover();
  await control.page().waitForTimeout(250);
  await control.hover();
  await control.page().waitForTimeout(50);
  return control.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
    };
  });
};

const expectHostIconGeometry = async (control: Locator) => {
  await expect(control).toHaveCSS("width", "32px");
  await expect(control).toHaveCSS("height", "32px");
  await expect(control.locator("svg").first()).toHaveCSS("width", "16px");
  await expect(control.locator("svg").first()).toHaveCSS("height", "16px");
};

const expectHostFocus = async (control: Locator) => {
  await control.focus();
  await control.page().keyboard.press("Shift+Tab");
  await control.page().keyboard.press("Tab");
  await expect(control).toBeFocused();
  await expect(control).toHaveCSS("outline-style", "none");
  const focusRing = await control.evaluate((element) =>
    window.getComputedStyle(element).boxShadow
  );
  expect(focusRing).not.toBe("none");
};

const expectIconCentered = async (control: Locator) => {
  const controlBox = await control.boundingBox();
  const iconBox = await control.locator("svg").first().boundingBox();
  expect(controlBox).not.toBeNull();
  expect(iconBox).not.toBeNull();
  expect(
    Math.abs(
      controlBox!.x + controlBox!.width / 2 -
        (iconBox!.x + iconBox!.width / 2)
    )
  ).toBeLessThan(0.5);
  expect(
    Math.abs(
      controlBox!.y + controlBox!.height / 2 -
        (iconBox!.y + iconBox!.height / 2)
    )
  ).toBeLessThan(0.5);
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
  await page.getByRole("button", { name: "Select", exact: true }).click();
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
    await expectHostIconGeometry(selectionControl);
    await expectHostFocus(selectionControl);
    const expectedHover = await readHoverStyle(selectionControl);
    expect(expectedHover.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");

    const dockControl = page.getByRole("button", { name: "Box" });
    await expectHostIconGeometry(dockControl);
    await expect(readHoverStyle(dockControl)).resolves.toEqual(expectedHover);

    const activeDockItem = page.locator('[data-toolbar-item="select"]');
    const dockItem = page.locator('[data-toolbar-item="shape-group"]');
    const adjacentDockItem = page.locator('[data-toolbar-item="bg"]');
    const submenuTrigger = dockItem.locator(
      '[data-toolbar-submenu-trigger="true"]'
    );
    await expectHostIconGeometry(submenuTrigger);
    const activeDockBackground = await activeDockItem.evaluate(
      (element) => window.getComputedStyle(element).backgroundColor
    );
    await submenuTrigger.hover();
    await expect(dockItem).toHaveCSS("background-color", activeDockBackground);
    await expect(dockControl).toHaveCSS(
      "color",
      await activeDockItem
        .getByRole("button", { name: "Select", exact: true })
        .evaluate((element) => window.getComputedStyle(element).color)
    );
    await expect(adjacentDockItem).not.toHaveCSS(
      "background-color",
      activeDockBackground
    );
    await expect(submenuTrigger).toHaveCSS("border-left-width", "0px");

    const colorDockItem = page.locator('[data-toolbar-item="color"]');
    await colorDockItem
      .locator('[data-toolbar-submenu-trigger="true"]')
      .click();
    const ansiPaletteTab = page.getByRole("tab", { name: "ANSI 16" });
    const presetsPaletteTab = page.getByRole("tab", { name: "Presets" });
    await expectHostIconGeometry(ansiPaletteTab);
    await expectHostIconGeometry(presetsPaletteTab);
    await expectIconCentered(ansiPaletteTab);
    await expectIconCentered(presetsPaletteTab);
    await expect(ansiPaletteTab).toHaveCSS(
      "background-color",
      activeDockBackground
    );
    await expect(readHoverStyle(presetsPaletteTab)).resolves.toEqual(
      expectedHover
    );
    await page.keyboard.press("Escape");

    const railOrientation =
      scenario.viewport.width < 600 ? "horizontal" : "vertical";
    if (railOrientation === "horizontal") {
      await page.getByRole("button", { name: "Open library" }).click();
    }
    const sidebarControl = page
      .getByTestId(`character-view-rail-${railOrientation}`)
      .getByRole("tab", { name: "Nerd Icons" });
    await expectHostIconGeometry(sidebarControl);
    await expect(readHoverStyle(sidebarControl)).resolves.toEqual(expectedHover);
    if (railOrientation === "horizontal") {
      await page.keyboard.press("Escape");
    }

    const sidebarToggle = page.getByRole("button", { name: "Toggle Sidebar" });
    await expectHostIconGeometry(sidebarToggle);

    const appMenuControl = page.getByRole("button", { name: "Open menu" });
    await expectHostIconGeometry(appMenuControl);
    await expect(readHoverStyle(appMenuControl)).resolves.toEqual(expectedHover);

    const breadcrumbControl = page.getByRole("button", { name: "Select canvas" });
    await expect(breadcrumbControl).toHaveCSS("height", "32px");
    await expect(breadcrumbControl.locator("svg")).toHaveCount(2);
    for (const breadcrumbIcon of await breadcrumbControl.locator("svg").all()) {
      await expect(breadcrumbIcon).toHaveCSS("width", "16px");
      await expect(breadcrumbIcon).toHaveCSS("height", "16px");
    }
    await expect(readHoverStyle(breadcrumbControl)).resolves.toEqual(expectedHover);
    await breadcrumbControl.click();

    const sessionControl = page.getByRole("menuitem", { name: "Beta", exact: true });
    const sessionItem = page.locator('[data-canvas-session-row="host-b"]');
    await expect(sessionControl).toBeVisible();
    await sessionControl.hover();
    await expect(sessionItem).toHaveCSS(
      "background-color",
      activeDockBackground
    );
    await expect(sessionControl).toHaveCSS("color", expectedHover.color);
    const adjacentSessionItem = page.locator(
      '[data-canvas-session-row="host-c"]'
    );
    const manageControl = page.getByRole("menuitem", { name: "Manage Beta" });
    await manageControl.hover();
    await expect(sessionItem).toHaveCSS(
      "background-color",
      activeDockBackground
    );
    await expect(sessionControl).toHaveCSS("color", expectedHover.color);
    await expect(adjacentSessionItem).not.toHaveCSS(
      "background-color",
      activeDockBackground
    );

    await page.screenshot({
      path: testInfo.outputPath(`host-controls-${scenario.name.replace(" ", "-")}.png`),
      fullPage: true,
    });
  });
}
