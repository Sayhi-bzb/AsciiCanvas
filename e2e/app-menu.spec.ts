import { expect, test, type Page } from "@playwright/test";

const STORAGE_KEY = "ascii-canvas-persistence";

const seedAnimationSession = async (page: Page) => {
  const offset = { x: 160, y: 120 };
  const timeline = {
    frames: [{ id: "frame-1", name: "Frame 1", grid: [] }],
    currentFrameId: "frame-1",
    fps: 10,
    loop: true,
    onionSkin: {
      enabled: true,
      backwardLayers: 2,
      forwardLayers: 2,
      opacityFalloff: [0.5, 0.3, 0.1],
    },
  };
  await page.goto("/");
  await page.evaluate(
    ({ storageKey, offset, timeline }) => {
      const session = {
        id: "app-menu-animation",
        name: "Animation",
        mode: "animation",
        scene: [],
        grid: [],
        size: { width: 80, height: 25 },
        timeline,
        viewport: { offset, zoom: 1 },
      };
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          state: {
            offset,
            zoom: 1,
            canvasMode: "animation",
            structuredScene: [],
            structuredComponents: [],
            canvasBounds: session.size,
            animationTimeline: timeline,
            brushChar: "#",
            brushColor: "#111827",
            showGrid: true,
            exportShowGrid: false,
            canvasSessions: [session],
            activeCanvasId: session.id,
            grid: [],
          },
          version: 0,
        })
      );
    },
    { storageKey: STORAGE_KEY, offset, timeline }
  );
  await page.reload();
};

test.describe("App menu", () => {
  test("keeps inline actions open and closes when focus leaves", async ({
    page,
  }) => {
    test.slow();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const trigger = page.getByRole("button", { name: "Open menu" });
    const menuContent = page.locator(
      '[data-slot="dropdown-menu-content"]'
    );
    const canvasBreadcrumb = page.getByRole("button", { name: "Select canvas" });
    await expect(trigger).toBeVisible();
    await expect(page.locator('[data-slot="sidebar-footer"]')).toHaveCount(0);

    const triggerBox = await trigger.boundingBox();
    const breadcrumbBox = await canvasBreadcrumb.boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(breadcrumbBox).not.toBeNull();
    expect(triggerBox!.x + triggerBox!.width).toBeLessThanOrEqual(breadcrumbBox!.x);

    await trigger.click();
    const menu = page.getByRole("menu", { name: "Open menu" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem").allTextContents()).resolves.toEqual([
      "Import Canvas",
      "Export Blueprint",
      "Hide Workspace Grid",
      "Minimap",
      "User Manual",
      "Clear Canvas",
      "UI language",
      "Open Source Code",
    ]);

    await menu.getByRole("menuitem", { name: "Hide Workspace Grid" }).click();
    await expect(menu).toBeVisible();
    await expect(
      menu.getByRole("menuitem", { name: "Toggle Grid" })
    ).toBeVisible();

    await menu.getByRole("menuitem", { name: "Minimap" }).click();
    await expect(menu).toBeVisible();
    await expect(page.getByLabel("Canvas minimap")).toBeVisible();

    await menu.getByRole("menuitem", { name: "Export Blueprint" }).hover();
    const exportMenu = page.getByRole("menu", { name: "Export Blueprint" });
    await expect(exportMenu).toBeVisible();
    await expect(exportMenu.getByRole("menuitem").allTextContents()).resolves.toEqual([
      "TXT",
      "AsciiCanvas File",
      "ANSI",
      "PNG",
    ]);
    const projectDownload = page.waitForEvent("download");
    await exportMenu
      .getByRole("menuitem", { name: "AsciiCanvas File" })
      .click();
    const downloadedProject = await projectDownload;
    expect(downloadedProject.suggestedFilename()).toMatch(
      /^ascii-canvas-\d+\.ascanvas$/
    );
    await expect(menu).toBeVisible();
    await expect(exportMenu).toBeVisible();
    await exportMenu.getByRole("menuitem", { name: "TXT" }).hover();
    const txtMenu = page.getByRole("menu", { name: "TXT" });
    await expect(txtMenu).toBeVisible();
    await expect(txtMenu.getByRole("menuitem").allTextContents()).resolves.toEqual([
      "Copy",
      "Save",
    ]);
    await txtMenu.getByRole("menuitem", { name: "Copy" }).click();
    await expect(menu).toBeVisible();
    await expect(exportMenu).toBeVisible();
    await expect(txtMenu).toBeVisible();
    await txtMenu.getByRole("menuitem", { name: "Save" }).click();
    await expect(menu).toBeVisible();
    await expect(exportMenu).toBeVisible();
    await expect(txtMenu).toBeVisible();

    const separator = menu.locator('[data-slot="dropdown-menu-separator"]');
    await expect(separator).toHaveCSS("height", "2px");

    await page.mouse.click(700, 500);
    await expect(menuContent).toHaveCount(0);

    await trigger.click();
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(menuContent).toHaveCount(0);

    await trigger.click();
    const reopenedMenu = page.getByRole("menu", { name: "Open menu" });
    await reopenedMenu.getByRole("menuitem", { name: "User Manual" }).click();
    await expect(page.getByRole("dialog")).toContainText("User Manual");
    await expect(menuContent).toHaveCount(0);
    await page.keyboard.press("Escape");

    await trigger.click();
    const clearMenu = page.getByRole("menu", { name: "Open menu" });
    await clearMenu.getByRole("menuitem", { name: "Clear Canvas" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await expect(menuContent).toHaveCount(0);
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  test("auto-detects imports and supports language and keyboard submenus", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const trigger = page.getByRole("button", { name: "Open menu" });
    await trigger.click();
    const menu = page.getByRole("menu", { name: "Open menu" });

    const importChooser = page.waitForEvent("filechooser");
    await menu.getByRole("menuitem", { name: "Import Canvas" }).click();
    await importChooser;
    await expect(page.locator('input[type="file"]')).toHaveAttribute(
      "accept",
      ".ascanvas,.json,.cast,application/vnd.ascii-canvas+json,application/json,text/plain"
    );
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(
      page.locator('[data-slot="dropdown-menu-content"]')
    ).toHaveCount(0);

    await trigger.click();
    const languageRootMenu = page.getByRole("menu", { name: "Open menu" });
    await languageRootMenu.getByRole("menuitem", { name: "UI language" }).hover();
    const languageMenu = page.getByRole("menu", { name: "UI language" });
    await expect(
      languageMenu.getByRole("menuitemradio", { name: "English" })
    ).toHaveAttribute("data-state", "checked");
    await languageMenu.getByRole("menuitemradio", { name: "中文" }).click();
    await expect(page.locator('[data-slot="dropdown-menu-content"]')).toBeVisible();
    await expect(
      page.getByRole("menuitemradio", { name: "中文" })
    ).toHaveAttribute("data-state", "checked");

    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(
      page.locator('[data-slot="dropdown-menu-content"]')
    ).toHaveCount(0);
    await page.getByRole("button", { name: "打开菜单" }).focus();
    await page.keyboard.press("ArrowDown");
    const keyboardMenu = page.getByRole("menu", { name: "打开菜单" });
    const importItem = keyboardMenu.getByRole("menuitem", {
      name: "导入画布",
    });
    const exportItem = keyboardMenu.getByRole("menuitem", {
      name: "导出蓝图",
    });
    await expect(importItem).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(exportItem).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("menu", { name: "导出蓝图" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(
      page.locator('[data-slot="dropdown-menu-content"]')
    ).toHaveCount(0);
  });

  test("shows animation export formats and makes GIF save-only", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedAnimationSession(page);

    const trigger = page.getByRole("button", { name: "Open menu" });
    const canvasBreadcrumb = page.getByRole("button", { name: "Select canvas" });
    const triggerBox = await trigger.boundingBox();
    const breadcrumbBox = await canvasBreadcrumb.boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(breadcrumbBox).not.toBeNull();
    expect(triggerBox!.x + triggerBox!.width).toBeLessThanOrEqual(breadcrumbBox!.x);

    await trigger.click();
    const menu = page.getByRole("menu", { name: "Open menu" });
    await expect(
      menu.getByRole("menuitem", { name: "Export Animation" })
    ).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Clear Frame" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Minimap" })).toHaveCount(0);

    await menu.getByRole("menuitem", { name: "Export Animation" }).hover();
    const exportMenu = page.getByRole("menu", { name: "Export Animation" });
    await expect(exportMenu).toBeVisible();
    await expect(exportMenu.getByRole("menuitem").allTextContents()).resolves.toEqual([
      "AsciiCanvas File",
      "CAST",
      "GIF",
    ]);
    await exportMenu.getByRole("menuitem", { name: "GIF" }).hover();
    const gifMenu = page.getByRole("menu", { name: "GIF" });
    await expect(gifMenu).toBeVisible();
    await expect(gifMenu.getByRole("menuitem").allTextContents()).resolves.toEqual([
      "Save",
    ]);
  });
});
