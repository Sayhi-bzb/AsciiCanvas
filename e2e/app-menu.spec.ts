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
  test("owns utility actions and keeps overlays alive after close", async ({
    page,
  }, testInfo) => {
    test.slow();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const trigger = page.getByRole("button", { name: "Open menu" });
    const sessionShell = page.locator('[data-session-tabs-shell="true"]');
    await expect(trigger).toBeVisible();
    await expect(page.locator('[data-slot="sidebar-footer"]')).toHaveCount(0);

    const triggerBox = await trigger.boundingBox();
    const sessionBox = await sessionShell.boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(sessionBox).not.toBeNull();
    expect(triggerBox!.x + triggerBox!.width).toBeLessThanOrEqual(sessionBox!.x);

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
      "切换到中文",
      "Open Source Code",
    ]);
    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();

    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");

    await trigger.click();
    const fileChooserPromise = page.waitForEvent("filechooser");
    await menu.getByRole("menuitem", { name: "Import Canvas" }).click();
    await fileChooserPromise;
    await expect(menu).not.toBeVisible();

    await trigger.click();
    await menu.getByRole("menuitem", { name: "Export Blueprint" }).click();
    await expect(page.getByRole("dialog")).toContainText("Export");
    await expect(menu).not.toBeVisible();
    await page.keyboard.press("Escape");

    await trigger.click();
    await menu.getByRole("menuitem", { name: "Minimap" }).click();
    await expect(page.getByLabel("Canvas minimap")).toBeVisible();
    await expect(menu).not.toBeVisible();
    await page.keyboard.press("Escape");

    await trigger.click();
    await menu.getByRole("menuitem", { name: "User Manual" }).click();
    await expect(page.getByRole("dialog")).toContainText("User Manual");
    await expect(menu).not.toBeVisible();
    await page.keyboard.press("Escape");

    await trigger.click();
    await menu.getByRole("menuitem", { name: "Clear Canvas" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await expect(menu).not.toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    await trigger.click();
    await menu.getByRole("menuitem", { name: "Hide Workspace Grid" }).click();
    await trigger.click();
    await expect(
      menu.getByRole("menuitem", { name: "Toggle Grid" })
    ).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath("app-menu-desktop.png"),
      fullPage: true,
    });
  });

  test("uses the mobile safe area and omits minimap in animation mode", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedAnimationSession(page);

    const trigger = page.getByRole("button", { name: "Open menu" });
    const sessionShell = page.locator('[data-session-tabs-shell="true"]');
    const triggerBox = await trigger.boundingBox();
    const sessionBox = await sessionShell.boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(sessionBox).not.toBeNull();
    expect(triggerBox!.x + triggerBox!.width).toBeLessThanOrEqual(sessionBox!.x);

    await trigger.click();
    const menu = page.getByRole("menu", { name: "Open menu" });
    await expect(menu.getByRole("menuitem", { name: "Export Animation" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Clear Frame" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Minimap" })).toHaveCount(0);
  });
});
