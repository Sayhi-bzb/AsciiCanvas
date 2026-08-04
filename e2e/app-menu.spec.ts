import { expect, test } from "@playwright/test";

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

    const gridControl = page.getByRole("button", {
      name: "Hide Workspace Grid",
    });
    const minimapControl = page.getByRole("button", { name: "Minimap" });
    await gridControl.click();
    await expect(
      page.getByRole("button", { name: "Toggle Grid" })
    ).toHaveAttribute("aria-pressed", "false");
    await minimapControl.click();
    const minimap = page.getByLabel("Canvas minimap");
    await expect(minimap).toBeVisible();
    const minimapBox = await minimap.boundingBox();
    const minimapControlBox = await minimapControl.boundingBox();
    expect(minimapBox).not.toBeNull();
    expect(minimapControlBox).not.toBeNull();
    expect(minimapBox!.y + minimapBox!.height).toBeLessThan(minimapControlBox!.y);

    const triggerBox = await trigger.boundingBox();
    const breadcrumbBox = await canvasBreadcrumb.boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(breadcrumbBox).not.toBeNull();
    expect(triggerBox!.x + triggerBox!.width).toBeLessThanOrEqual(breadcrumbBox!.x);

    await trigger.click();
    const menu = page.getByRole("menu", { name: "Open menu" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem").allTextContents()).resolves.toEqual([
      "Import",
      "Export",
      "Clear",
      "Language",
      "GitHub",
    ]);

    await menu.getByRole("menuitem", { name: "Export" }).hover();
    const exportMenu = page.getByRole("menu", { name: "Export" });
    await expect(exportMenu).toBeVisible();
    await expect(exportMenu.getByRole("menuitem").allTextContents()).resolves.toEqual([
      "TXT",
      "AsciiCanvas",
      "ANSI",
      "PNG",
    ]);
    const projectDownload = page.waitForEvent("download");
    await exportMenu
      .getByRole("menuitem", { name: "AsciiCanvas" })
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
    await expect(separator).toHaveClass(/bg-accent/);

    await page.mouse.click(700, 500);
    await expect(menuContent).toHaveCount(0);

    await trigger.click();
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(menuContent).toHaveCount(0);

    const helpControl = page.getByRole("button", { name: "User Manual" });
    const helpBox = await helpControl.boundingBox();
    expect(helpBox).not.toBeNull();
    expect(helpBox!.x + helpBox!.width).toBe(1428);
    expect(helpBox!.y + helpBox!.height).toBe(888);
    await expect(page.locator('[data-slot="sidebar-content"]')).toHaveCSS(
      "padding-bottom",
      "48px"
    );

    await helpControl.click();
    await expect(page.getByRole("dialog")).toContainText("User Manual");
    await page.keyboard.press("Escape");

    await trigger.click();
    const clearMenu = page.getByRole("menu", { name: "Open menu" });
    await clearMenu.getByRole("menuitem", { name: "Clear" }).click();
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
    await menu.getByRole("menuitem", { name: "Import" }).click();
    await importChooser;
    await expect(page.locator('input[type="file"]')).toHaveAttribute(
      "accept",
      ".ascanvas,.json,application/vnd.ascii-canvas+json,application/json,text/plain"
    );
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(
      page.locator('[data-slot="dropdown-menu-content"]')
    ).toHaveCount(0);

    await trigger.click();
    const languageRootMenu = page.getByRole("menu", { name: "Open menu" });
    await languageRootMenu.getByRole("menuitem", { name: "Language" }).hover();
    const languageMenu = page.getByRole("menu", { name: "Language" });
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
      name: "导入",
    });
    const exportItem = keyboardMenu.getByRole("menuitem", {
      name: "导出",
    });
    await expect(importItem).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(exportItem).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("menu", { name: "导出" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(
      page.locator('[data-slot="dropdown-menu-content"]')
    ).toHaveCount(0);
  });

});
