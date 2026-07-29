import { expect, test, type Page } from "@playwright/test";

const STORAGE_KEY = "ascii-canvas-persistence";

const seedAnimationSidebar = async (
  page: Page,
  viewport: { width: number; height: number },
  dark: boolean,
  frameCount = 3
) => {
  const offset = viewport.width < 600 ? { x: 80, y: 100 } : { x: 180, y: 130 };
  const initialNames = ["Opening", "Middle", "Closing"];
  const frames = Array.from({ length: frameCount }, (_, index) => ({
    id: `frame-${index + 1}`,
    name: initialNames[index] ?? `Frame ${index + 1}`,
    grid: [],
  }));
  const timeline = {
    frames,
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

  await page.setViewportSize(viewport);
  await page.goto("/");
  await page.evaluate(
    ({ storageKey, offset, timeline }) => {
      const session = {
        id: "animation-sidebar",
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
  await page.evaluate((useDarkTheme) => {
    document.documentElement.classList.toggle("dark", useDarkTheme);
  }, dark);

  if (viewport.width < 600) {
    await page.getByRole("button", { name: "Open library" }).click();
  }
};

for (const scenario of [
  { name: "desktop light", viewport: { width: 1440, height: 900 }, dark: false },
  { name: "desktop dark", viewport: { width: 1440, height: 900 }, dark: true },
  { name: "mobile light", viewport: { width: 390, height: 844 }, dark: false },
  { name: "mobile dark", viewport: { width: 390, height: 844 }, dark: true },
]) {
  test(`Animation sidebar uses a production filmstrip in ${scenario.name}`, async ({
    page,
  }, testInfo) => {
    await seedAnimationSidebar(page, scenario.viewport, scenario.dark);

    await expect(page.getByTestId("sidebar-header-content").getByText("Animation", { exact: true })).toBeVisible();
    const framesTab = page.getByRole("tab", { name: "Frames" });
    const effectsTab = page.getByRole("tab", { name: "Effects" });
    const commandBar = page.getByTestId("animation-frame-command-bar");
    const frameList = page.getByRole("list", { name: "Animation frames" });
    const frameItems = frameList.locator(":scope > li");
    const selectionButtons = frameList.getByRole("button", { name: /Select Frame/ });

    await expect(framesTab).toHaveAttribute("aria-selected", "true");
    await expect(commandBar).toBeVisible();
    await expect(frameItems).toHaveCount(3);
    await expect(frameItems.first()).toHaveCSS("height", "56px");
    await expect(frameItems.first().locator("[data-current=true]")).toHaveCount(1);
    await expect(selectionButtons.first()).toHaveAttribute("aria-pressed", "true");

    const tabsBox = await framesTab.locator("..").boundingBox();
    const commandBox = await commandBar.boundingBox();
    const listBox = await frameList.boundingBox();
    expect(tabsBox).not.toBeNull();
    expect(commandBox).not.toBeNull();
    expect(listBox).not.toBeNull();
    expect(tabsBox!.y + tabsBox!.height).toBeLessThanOrEqual(commandBox!.y + 1);
    expect(commandBox!.y + commandBox!.height).toBeLessThanOrEqual(
      listBox!.y + 1
    );

    await selectionButtons.nth(1).click({ modifiers: ["Control"] });
    await expect(page.getByText("2 selected")).toBeVisible();
    await expect(page.getByRole("button", { name: "Rename" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Delete" })).toBeEnabled();

    await effectsTab.click();
    await expect(effectsTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel", { name: "Effects" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sweep" })).toBeVisible();

    await framesTab.click();
    if (scenario.viewport.width >= 600) {
      await page.getByRole("button", { name: "Toggle Sidebar" }).click();
      await expect(frameList).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Toggle Sidebar" }))
        .toBeVisible();
    }

    await page.screenshot({
      path: testInfo.outputPath(
        `animation-sidebar-${scenario.name.replace(" ", "-")}.png`
      ),
      fullPage: true,
    });
  });
}

test("Animation frames reorder as a selected block and support keyboard sorting", async ({
  page,
}) => {
  await seedAnimationSidebar(page, { width: 1440, height: 900 }, false);

  const frameList = page.getByRole("list", { name: "Animation frames" });
  const frameItems = frameList.locator(":scope > li");
  const selectMiddle = page.getByRole("button", {
    name: "Select Frame 2: Middle",
  });
  const selectClosing = page.getByRole("button", {
    name: "Select Frame 3: Closing",
  });

  await selectMiddle.click();
  await selectClosing.click({ modifiers: ["Control"] });
  await expect(page.getByText("2 selected")).toBeVisible();
  await page.evaluate((storageKey) => {
    const storagePrototype = Storage.prototype;
    const originalSetItem = storagePrototype.setItem;
    let persistenceWrites = 0;
    Object.defineProperty(window, "__getAnimationPersistenceWrites", {
      configurable: true,
      value: () => persistenceWrites,
    });
    storagePrototype.setItem = function (key, value) {
      if (key === storageKey) persistenceWrites += 1;
      return originalSetItem.call(this, key, value);
    };
  }, STORAGE_KEY);
  const getPersistenceWrites = () =>
    page.evaluate(() =>
      (window as Window & { __getAnimationPersistenceWrites: () => number })
        .__getAnimationPersistenceWrites()
    );

  const dragHandle = page.getByRole("button", { name: "Reorder Middle" });
  const dragTarget = page.getByRole("button", {
    name: "Select Frame 1: Opening",
  });
  const handleBox = await dragHandle.boundingBox();
  const targetBox = await dragTarget.boundingBox();
  expect(handleBox).not.toBeNull();
  expect(targetBox).not.toBeNull();

  await page.mouse.move(
    handleBox!.x + handleBox!.width / 2,
    handleBox!.y + handleBox!.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox!.x + targetBox!.width / 2,
    targetBox!.y + targetBox!.height / 2,
    { steps: 12 }
  );
  await expect(page.getByTestId("animation-frame-drag-overlay")).toBeVisible();
  await page.mouse.up();

  await expect(frameItems.nth(0)).toContainText("Middle");
  await expect(frameItems.nth(1)).toContainText("Closing");
  await expect(frameItems.nth(2)).toContainText("Opening");
  await expect(page.getByTestId("animation-frame-drag-overlay")).toHaveCount(0);
  await expect.poll(getPersistenceWrites).toBe(1);

  const openingHandle = page.getByRole("button", { name: "Reorder Opening" });
  await openingHandle.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(200);
  await page.keyboard.press("Space");
  await expect(page.getByTestId("animation-frame-drag-overlay")).toHaveCount(0);

  await expect(frameItems.nth(0)).toContainText("Middle");
  await expect(frameItems.nth(1)).toContainText("Opening");
  await expect(frameItems.nth(2)).toContainText("Closing");
  await expect.poll(getPersistenceWrites).toBe(2);
});

test("Animation frame dragging auto-scrolls the filmstrip viewport", async ({
  page,
}) => {
  await seedAnimationSidebar(page, { width: 1440, height: 600 }, false, 18);

  const frameList = page.getByRole("list", { name: "Animation frames" });
  const scrollViewport = frameList.locator(
    "xpath=ancestor::*[@data-slot='scroll-area-viewport']"
  );
  const firstHandle = page.getByRole("button", { name: "Reorder Opening" });
  const handleBox = await firstHandle.boundingBox();
  const viewportBox = await scrollViewport.boundingBox();
  expect(handleBox).not.toBeNull();
  expect(viewportBox).not.toBeNull();

  await page.mouse.move(
    handleBox!.x + handleBox!.width / 2,
    handleBox!.y + handleBox!.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    handleBox!.x + handleBox!.width / 2,
    viewportBox!.y + viewportBox!.height - 4,
    { steps: 16 }
  );
  await expect(page.getByTestId("animation-frame-drag-overlay")).toBeVisible();
  await expect
    .poll(() => scrollViewport.evaluate((element) => element.scrollTop), {
      timeout: 4_000,
    })
    .toBeGreaterThan(0);
  await page.mouse.up();
});
