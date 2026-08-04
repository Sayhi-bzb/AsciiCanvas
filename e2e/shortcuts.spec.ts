import { expect, test, type Page } from "@playwright/test";

const STORAGE_KEY = "ascii-canvas-persistence";
const CELL_WIDTH = 9;
const VIEWPORT = { offset: { x: 180, y: 130 }, zoom: 1 };

const seedFreeformSelection = async (page: Page) => {
  await page.evaluate(
    ({ storageKey, viewport }) => {
      const session = {
        id: "shortcut-e2e",
        name: "Shortcut E2E",
        mode: "freeform",
        scene: [],
        grid: [
          ["0,0", { char: "A", color: "#111827" }],
          ["1,0", { char: "B", color: "#111827" }],
        ],
        viewport,
      };
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          state: {
            offset: viewport.offset,
            zoom: viewport.zoom,
            canvasMode: session.mode,
            structuredScene: [],
            structuredComponents: [],
            brushChar: "#",
            brushColor: "#111827",
            showGrid: true,
            exportShowGrid: false,
            canvasSessions: [session],
            activeCanvasId: session.id,
            grid: session.grid,
          },
          version: 0,
        })
      );
    },
    { storageKey: STORAGE_KEY, viewport: VIEWPORT }
  );
  await page.reload();
  const surface = page.getByTestId("ascii-canvas-surface");
  await expect(surface).toBeVisible();
  await page
    .getByTestId("tool-dock")
    .getByRole("button", { name: "Select", exact: true })
    .click();
  const box = await surface.boundingBox();
  expect(box).not.toBeNull();
  const start = {
    x: box!.x + VIEWPORT.offset.x + 2,
    y: box!.y + VIEWPORT.offset.y + 8,
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + CELL_WIDTH + 4, start.y, { steps: 3 });
  await page.mouse.up();
  await expect(surface.locator("textarea")).toBeFocused();
};

const readGrid = (page: Page) =>
  page.evaluate((storageKey) => {
    const state = JSON.parse(localStorage.getItem(storageKey)!).state;
    return state.workspace?.grid ?? state.grid;
  }, STORAGE_KEY);

test.describe("editor clipboard shortcuts", () => {
  test.beforeEach(async ({ browserName, context, page }) => {
    if (browserName === "chromium") {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
  });

  for (const shortcut of ["Meta+x", "Control+x"]) {
    test(`${shortcut} cuts the managed canvas selection`, async ({ page }) => {
      await seedFreeformSelection(page);

      await page.keyboard.press(shortcut);

      await expect.poll(() => readGrid(page)).toEqual([]);
    });
  }

  test("platform digits select visible Dock tools without reserving Shift+H", async ({
    page,
  }, testInfo) => {
    const dock = page.getByTestId("tool-dock");
    const handItem = dock.locator('[data-toolbar-item="pan"]');
    const selectItem = dock.locator('[data-toolbar-item="select"]');

    const dockModifier =
      testInfo.project.name === "webkit-shortcuts" ? "Control" : "Alt";
    await page.keyboard.press(`${dockModifier}+1`);
    await expect(handItem).toHaveClass(/bg-accent/);

    await page.keyboard.press(`${dockModifier}+2`);
    await expect(selectItem).toHaveClass(/bg-accent/);

    await page.keyboard.press("Shift+H");
    await expect(selectItem).toHaveClass(/bg-accent/);

    await page.keyboard.press(`${dockModifier}+6`);
    const colorDialog = page.getByRole("dialog", { name: "Color" });
    await expect(colorDialog).toBeFocused();
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(colorDialog).toBeHidden();

    await dock.getByRole("button", { name: "Hand" }).hover();
    await expect(page.getByRole("tooltip")).toContainText(/(?:Alt\+|⌃)1/);
  });

  test("Meta+x followed by Meta+v restores the cut selection", async ({
    browserName,
    page,
  }) => {
    test.skip(browserName === "webkit", "Playwright WebKit does not bridge the native system clipboard");
    await seedFreeformSelection(page);

    await page.keyboard.press("Meta+x");
    await expect.poll(() => readGrid(page)).toEqual([]);

    await page.keyboard.press("Meta+v");
    await expect.poll(() => readGrid(page)).toEqual([
      ["0,0", { char: "A", color: "#111827" }],
      ["1,0", { char: "B", color: "#111827" }],
    ]);
  });

  test("native paste data restores a cut selection", async ({ page }) => {
    await seedFreeformSelection(page);

    await page.keyboard.press("Meta+x");
    await expect.poll(() => readGrid(page)).toEqual([]);

    await page.evaluate(() => {
      const clipboardData = new DataTransfer();
      clipboardData.setData("text/plain", "AB");
      const target = document.activeElement ?? document.body;
      target.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData,
        })
      );
    });
    await expect.poll(() => readGrid(page)).toEqual([
      ["0,0", { char: "A", color: "#111827" }],
      ["1,0", { char: "B", color: "#111827" }],
    ]);
  });
});
