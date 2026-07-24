import { test, expect, type Page } from '@playwright/test';

const STORAGE_KEY = 'ascii-canvas-persistence';
const CELL_WIDTH = 9;
const CELL_HEIGHT = 19;

const seedSession = async (
  page: Page,
  session: Record<string, unknown>,
) => {
  await page.evaluate(
    ({ storageKey, seededSession }) => {
      const viewport = seededSession.viewport as {
        offset: { x: number; y: number };
        zoom: number;
      };
      localStorage.setItem(storageKey, JSON.stringify({
        state: {
          offset: viewport.offset,
          zoom: viewport.zoom,
          canvasMode: seededSession.mode,
          structuredScene: seededSession.scene ?? [],
          structuredComponents: [],
          canvasBounds: seededSession.size ?? null,
          animationTimeline: seededSession.timeline ?? null,
          brushChar: '#',
          brushColor: '#111827',
          showGrid: true,
          exportShowGrid: false,
          canvasSessions: [seededSession],
          activeCanvasId: seededSession.id,
          grid: seededSession.grid ?? [],
        },
        version: 0,
      }));
    },
    { storageKey: STORAGE_KEY, seededSession: session },
  );
  await page.reload();
  await expect(page.getByTestId('ascii-canvas-surface')).toBeVisible();
};

const readPersistedState = async (
  page: Page,
) => page.evaluate((storageKey) => {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;
  const state = JSON.parse(raw).state;
  if (!state?.workspace || !state?.sessions) return state;
  return {
    ...state.workspace,
    ...state.preferences,
    canvasSessions: state.sessions.items,
    activeCanvasId: state.sessions.activeId,
  };
}, STORAGE_KEY);

test.describe('Canvas', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
  });

  test('should display canvas', async ({ page }) => {
    // Canvas should be visible
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
  });

  test('recovers an incomplete v2 session payload before the first render', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.evaluate((storageKey) => {
      localStorage.setItem(storageKey, JSON.stringify({
        state: {
          schemaVersion: 2,
          workspace: {
            offset: { x: 12, y: 8 },
            zoom: 1.25,
            canvasMode: 'freeform',
            grid: [['0,0', { char: 'A', color: '#ffffff' }]],
            structuredScene: [],
            structuredComponents: [],
            canvasBounds: null,
            animationTimeline: null,
          },
          sessions: {
            activeId: 'canvas-1',
          },
          preferences: {
            brushChar: '#',
            brushColor: '#ffffff',
            showGrid: true,
            exportShowGrid: false,
          },
        },
        version: 2,
      }));
    }, STORAGE_KEY);

    await page.reload();

    await expect(page.getByTestId('ascii-canvas-surface')).toBeVisible();
    await expect(
      page.getByRole('tab', { name: 'Expand canvas sessions' })
    ).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('keeps the color picker bounds stable when switching palette tabs', async ({ page }) => {
    const colorItem = page.locator('[data-toolbar-item="color"]');
    await colorItem.locator('button').last().click();

    const paletteTabs = page.getByRole('tablist', { name: 'Color palettes' });
    const popover = page.locator('[data-slot="popover-content"]').filter({
      has: paletteTabs,
    });
    await expect(popover).toBeVisible();
    const ansiBounds = await popover.boundingBox();
    expect(ansiBounds).not.toBeNull();

    await paletteTabs.getByRole('tab', { name: 'Presets' }).click();
    await expect(
      paletteTabs.getByRole('tab', { name: 'Presets' })
    ).toHaveAttribute('aria-selected', 'true');
    const presetBounds = await popover.boundingBox();
    expect(presetBounds).not.toBeNull();

    const contentFrame = page.getByTestId('color-picker-content-frame');
    const frameMetrics = await contentFrame.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(frameMetrics.scrollHeight).toBeLessThanOrEqual(
      frameMetrics.clientHeight
    );

    expect(Math.abs(presetBounds!.width - ansiBounds!.width))
      .toBeLessThanOrEqual(1);
    expect(Math.abs(presetBounds!.height - ansiBounds!.height))
      .toBeLessThanOrEqual(1);
    expect(Math.abs(presetBounds!.x - ansiBounds!.x))
      .toBeLessThanOrEqual(1);
    expect(Math.abs(presetBounds!.y - ansiBounds!.y))
      .toBeLessThanOrEqual(1);
  });

  test('self-hosts routed fonts and renders emoji with the canvas color', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const faces = await Promise.all([
        document.fonts.load('24px "Maple Mono NF CN"', 'A╭你'),
        document.fonts.load('24px "Noto Sans Symbols 2"', '⟹◈♪'),
        document.fonts.load('40px "Noto Emoji"', '👩🏽‍💻'),
      ]);
      await document.fonts.ready;

      const canvas = document.createElement('canvas');
      canvas.width = 96;
      canvas.height = 96;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 96, 96);
      ctx.font = '40px "Noto Emoji"';
      ctx.fillStyle = 'rgb(255, 0, 0)';
      ctx.textBaseline = 'top';
      ctx.fillText('😀', 8, 8);
      const pixels = ctx.getImageData(0, 0, 96, 96).data;
      let painted = 0;
      let offColor = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] === 0) continue;
        painted += 1;
        if (pixels[index + 1] > 2 || pixels[index + 2] > 2) offColor += 1;
      }

      const externalFontRequests = performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((url) =>
          /fontsapi\.zeoseven\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url)
        );
      return {
        loadedFamilies: faces.map((items) => items.map((face) => face.family)),
        painted,
        offColor,
        externalFontRequests,
      };
    });

    expect(result.loadedFamilies[0]).toContain('Maple Mono NF CN');
    expect(result.loadedFamilies[1]).toContain('Noto Sans Symbols 2');
    expect(result.loadedFamilies[2]).toContain('Noto Emoji');
    expect(result.painted).toBeGreaterThan(0);
    expect(result.offColor).toBe(0);
    expect(result.externalFontRequests).toEqual([]);
  });

  test('loads curated character packs before lazy Unicode explorer shards', async ({ page }) => {
    const requested: string[] = [];
    await page.goto('about:blank');
    await page.route('**/data/characters/**', async (route) => {
      requested.push(route.request().url());
      await route.continue();
    });
    await page.goto('/');
    await expect(page.getByRole('searchbox', { name: 'Search characters' })).toBeVisible();

    await expect.poll(() => requested).toEqual(expect.arrayContaining([
      expect.stringContaining('/data/characters/manifest.json'),
      expect.stringContaining('/data/characters/packs/essentials.'),
      expect.stringContaining('/data/characters/packs/nerd.'),
      expect.stringContaining('/data/characters/packs/emoji.'),
    ]));

    const beforeOpen = requested.filter((url) =>
      url.includes('/data/characters/unicode/')
    );
    expect(beforeOpen).toEqual([]);

    await page.getByRole('tab', { name: 'Unicode' }).click();
    await expect.poll(() => requested.filter((url) =>
      url.includes('/data/characters/unicode/')
    )).toEqual(expect.arrayContaining([
      expect.stringContaining('/data/characters/unicode/manifest.'),
      expect.stringContaining('/data/characters/unicode/shards/'),
    ]));

    expect(requested.some((url) => url.includes('/name-index.'))).toBe(false);
    expect(await page.locator('button[data-character-codepoints]').count()).toBeLessThanOrEqual(300);

    await page.getByRole('searchbox', { name: 'Search characters' }).fill(
      'latin capital letter a'
    );
    await page.getByRole('button', { name: 'Search all Unicode' }).click();
    await expect.poll(() => requested).toEqual(expect.arrayContaining([
      expect.stringContaining('/data/characters/unicode/name-index.'),
    ]));
  });

  test('localizes curated character directories without translating view names', async ({ page }) => {
    await expect(page.getByText('ASCII & Punctuation', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'UI language' }).click();
    await expect(page.getByText('ASCII 与标点', { exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Essentials', exact: true })).toBeVisible();

    await page.getByRole('tab', { name: 'Nerd Icons', exact: true }).click();
    await expect(page.getByText('天气图标', { exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Nerd Icons', exact: true })).toBeVisible();

    await page.getByRole('tab', { name: 'Emoji', exact: true }).click();
    await expect(page.getByText('笑脸与情感', { exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Emoji', exact: true })).toBeVisible();
  });

  test('uses horizontal character view tabs in the mobile sheet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Open library' }).click();

    const mobileSidebar = page.locator(
      '[data-slot="sidebar"][data-mobile="true"]'
    );
    await expect(mobileSidebar).toBeVisible();
    await expect(mobileSidebar).toHaveCSS('width', '288px');
    await expect(mobileSidebar).toHaveCSS('border-left-width', '0px');
    await expect(mobileSidebar).toHaveCSS(
      'box-shadow',
      /rgba\(0, 0, 0, 0\) 0px 0px 0px 0px/
    );
    await expect(
      mobileSidebar.getByTestId('character-view-rail-horizontal')
    ).toBeVisible();
    await expect(
      mobileSidebar.getByTestId('character-view-rail-vertical')
    ).toHaveCount(0);

    const tabs = mobileSidebar.getByRole('tab');
    await expect(tabs).toHaveCount(4);
    expect(await tabs.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('aria-label'))
    )).toEqual([
      'Essentials',
      'Nerd Icons',
      'Emoji',
      'Unicode',
    ]);

    await mobileSidebar.getByRole('tab', { name: 'Unicode' }).click();
    await expect(
      mobileSidebar.getByRole('tabpanel', { name: 'Unicode characters' })
    ).toBeVisible();
  });

  test('uses a left view rail for the structured library and preserves it when collapsed', async ({ page }) => {
    await seedSession(page, {
      id: 'structured-sidebar-e2e',
      name: 'Structured Sidebar E2E',
      mode: 'structured',
      scene: [],
      grid: [],
      viewport: { offset: { x: 180, y: 130 }, zoom: 1 },
    });

    const sidebar = page.locator(
      '[data-slot="sidebar"][data-side="right"]'
    );
    const rail = page.getByTestId('structured-view-rail-vertical');
    await expect(rail).toBeVisible();
    await expect(page.getByTestId('structured-view-rail-horizontal')).toHaveCount(0);
    await expect(rail.getByRole('tab')).toHaveCount(2);
    await expect(rail.getByRole('tab', { name: 'Components' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByRole('searchbox', { name: 'Search structured library' }))
      .toBeVisible();

    await rail.getByRole('tab', { name: 'Template' }).click();
    await expect(page.getByRole('tabpanel', { name: 'Template' })).toBeVisible();

    await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
    await expect(sidebar).toHaveAttribute('data-state', 'collapsed');
    await expect(page.getByRole('searchbox', { name: 'Search structured library' }))
      .toHaveCount(0);
    await expect(page.getByTestId('structured-view-rail-vertical')).toBeVisible();

    await page.getByRole('tab', { name: 'Components' }).click();
    await expect(sidebar).toHaveAttribute('data-state', 'expanded');
    await expect(page.getByRole('tabpanel', { name: 'Components' })).toBeVisible();
  });

  test('uses a horizontal structured view rail in the mobile sheet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedSession(page, {
      id: 'structured-mobile-sidebar-e2e',
      name: 'Structured Mobile Sidebar E2E',
      mode: 'structured',
      scene: [],
      grid: [],
      viewport: { offset: { x: 80, y: 90 }, zoom: 1 },
    });
    await page.getByRole('button', { name: 'Open library' }).click();

    const mobileSidebar = page.locator(
      '[data-slot="sidebar"][data-mobile="true"]'
    );
    await expect(
      mobileSidebar.getByTestId('structured-view-rail-horizontal')
    ).toBeVisible();
    await expect(
      mobileSidebar.getByTestId('structured-view-rail-vertical')
    ).toHaveCount(0);
    await expect(
      mobileSidebar.getByTestId('structured-view-rail-horizontal').getByRole('tab')
    ).toHaveCount(2);
  });

  test('keeps the top bar centered while the sidebar collapses', async ({ page }) => {
    const lane = page.locator('[data-session-tabs-lane="true"]');
    const sidebar = page.locator(
      '[data-slot="sidebar"][data-side="right"]'
    );
    const toggle = page.getByRole('button', { name: 'Toggle Sidebar' });

    await expect(lane).toHaveCSS('left', '64px');
    await expect(lane).toHaveCSS('right', '64px');
    const initialBox = await lane.boundingBox();
    expect(initialBox).not.toBeNull();
    const initialCenter = initialBox!.x + initialBox!.width / 2;

    await toggle.click();
    await expect(sidebar).toHaveAttribute('data-state', 'collapsed');
    const collapsedBox = await lane.boundingBox();
    expect(collapsedBox).not.toBeNull();
    expect(collapsedBox!.x + collapsedBox!.width / 2).toBeCloseTo(initialCenter);

    await toggle.click();
    await expect(sidebar).toHaveAttribute('data-state', 'expanded');
    const expandedBox = await lane.boundingBox();
    expect(expandedBox).not.toBeNull();
    expect(expandedBox!.x + expandedBox!.width / 2).toBeCloseTo(initialCenter);
  });

  test('moves the sidebar trigger on a horizontal path', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Toggle Sidebar' });
    const sidebar = page.locator(
      '[data-slot="sidebar"][data-side="right"]'
    );
    const initialBox = await trigger.boundingBox();
    expect(initialBox).not.toBeNull();
    const initialCenter = {
      x: initialBox!.x + initialBox!.width / 2,
      y: initialBox!.y + initialBox!.height / 2,
    };
    const sampleMotion = () => trigger.evaluate(async (element) => {
      const control = element as HTMLElement;
      const points: Array<{ x: number; y: number }> = [];
      control.click();
      const startedAt = performance.now();
      do {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const rect = control.getBoundingClientRect();
        points.push({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      } while (performance.now() - startedAt < 260);
      return points;
    });
    const expectHorizontalPath = (points: Array<{ x: number; y: number }>) => {
      expect(points.length).toBeGreaterThan(2);
      const yValues = points.map((point) => point.y);
      expect(Math.max(...yValues) - Math.min(...yValues)).toBeLessThanOrEqual(1);
      expect(Math.abs(points.at(-1)!.x - points[0].x)).toBeGreaterThan(1);
    };

    const collapsePoints = await sampleMotion();
    expectHorizontalPath(collapsePoints);
    await expect(sidebar).toHaveAttribute('data-state', 'collapsed');
    expect(collapsePoints.at(-1)!.y).toBeCloseTo(initialCenter.y);

    await trigger.click();
    await expect(sidebar).toHaveAttribute('data-state', 'expanded');
    await page.waitForTimeout(250);
    const expandedBox = await trigger.boundingBox();
    expect(expandedBox).not.toBeNull();
    expect(expandedBox!.x + expandedBox!.width / 2).toBeCloseTo(initialCenter.x);
    expect(expandedBox!.y + expandedBox!.height / 2).toBeCloseTo(initialCenter.y);
  });

  test('uses borderless color-block chrome for the desktop sidebar', async ({ page }) => {
    const sidebarInner = page.locator('[data-slot="sidebar-inner"]');
    const header = page.locator('[data-slot="sidebar-header"]');
    const footer = page.locator('[data-slot="sidebar-footer"]');
    const railShell = page
      .getByTestId('character-view-rail-vertical')
      .locator('..');
    const search = page.getByRole('searchbox', { name: 'Search characters' });

    await expect(sidebarInner).toHaveCSS('border-top-width', '0px');
    await expect(sidebarInner).toHaveCSS(
      'box-shadow',
      /rgba\(0, 0, 0, 0\) 0px 0px 0px 0px/
    );
    await expect(header).toHaveCSS('border-bottom-width', '0px');
    await expect(footer).toHaveCSS('border-top-width', '0px');
    await expect(railShell).toHaveCSS('border-right-width', '0px');
    await expect(search).toHaveCSS('border-top-width', '0px');

    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await expect(sidebarInner).toHaveCSS('border-top-width', '0px');
    await expect(search).toHaveCSS('border-top-width', '0px');
  });

  test('delays tooltips and places them by interface region', async ({ page }) => {
    const tooltip = page.locator('[data-slot="tooltip-content"]');

    const dockTrigger = page
      .locator('[role="toolbar"]')
      .first()
      .getByRole('button', { name: 'Select', exact: true });
    await dockTrigger.hover();
    await page.waitForTimeout(250);
    await expect(tooltip).toHaveCount(0);
    await expect(tooltip).toBeVisible({ timeout: 1_000 });
    await expect(tooltip).toHaveAttribute('data-side', 'top');

    await page.mouse.move(0, 0);
    await page.waitForTimeout(350);

    const languageTrigger = page.getByRole('button', { name: 'UI language' });
    await languageTrigger.hover();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveAttribute('data-side', 'top');

    await page.mouse.move(0, 0);
    await page.waitForTimeout(350);

    const characterTrigger = page.locator('button[data-character-codepoints]').nth(40);
    await expect(characterTrigger).toBeVisible();
    await characterTrigger.hover();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveAttribute('data-side', 'top');
    await expect(tooltip.locator(':scope > [data-slot="tooltip-title"]')).toBeVisible();
    await expect(tooltip.locator(':scope > [data-slot="tooltip-meta"]')).toContainText('U+');

    await page.mouse.move(0, 0);
    await page.waitForTimeout(350);
    await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
    await languageTrigger.hover();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveAttribute('data-side', 'left');
  });

  test('should have toolbar', async ({ page }) => {
    // Toolbar buttons should be visible
    const toolbar = page.locator('[role="toolbar"]').first();
    await expect(toolbar).toBeVisible();
  });

  test('should create new session', async ({ page }) => {
    const createButton = page.getByRole('button', {
      name: 'Create new canvas',
    });
    await createButton.click();
    await createButton.click();
    await page.getByRole('button', { name: 'New Freeform' }).click();

    await expect.poll(async () => {
      const state = await readPersistedState(page);
      return state?.canvasSessions?.length ?? 0;
    }).toBeGreaterThan(2);
  });

  test('commits a freeform shape drag to the persisted grid', async ({ page }) => {
    const viewport = { offset: { x: 180, y: 130 }, zoom: 1 };
    await seedSession(page, {
      id: 'freeform-e2e', name: 'Freeform E2E', mode: 'freeform',
      scene: [], grid: [], viewport,
    });
    await page.getByRole('button', { name: 'Box' }).click();
    const surface = page.getByTestId('ascii-canvas-surface');
    const box = await surface.boundingBox();
    expect(box).not.toBeNull();
    const start = {
      x: box!.x + viewport.offset.x + 2 * CELL_WIDTH,
      y: box!.y + viewport.offset.y + 2 * CELL_HEIGHT,
    };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 3 * CELL_WIDTH, start.y, { steps: 4 });
    await page.mouse.up();

    await expect.poll(async () => {
      const state = await readPersistedState(page);
      return state.grid.length;
    }).toBeGreaterThan(0);
  });

  test('moves a structured node and persists the scene', async ({ page }) => {
    const viewport = { offset: { x: 180, y: 130 }, zoom: 1 };
    const node = {
      id: 'box-1', type: 'box', order: 1,
      start: { x: 0, y: 0 }, end: { x: 8, y: 4 },
      style: { color: '#111827' },
    };
    await seedSession(page, {
      id: 'structured-e2e', name: 'Structured E2E', mode: 'structured',
      scene: [node], components: [], grid: [], viewport,
    });
    const box = await page.getByTestId('ascii-canvas-surface').boundingBox();
    expect(box).not.toBeNull();
    const start = {
      x: box!.x + viewport.offset.x + 4 * CELL_WIDTH,
      y: box!.y + viewport.offset.y + 2 * CELL_HEIGHT,
    };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 2 * CELL_WIDTH, start.y + CELL_HEIGHT, { steps: 4 });
    await page.mouse.up();

    await expect.poll(async () => {
      const state = await readPersistedState(page);
      const moved = state.structuredScene.find((item: { id: string }) => item.id === node.id);
      return moved?.start;
    }).toEqual({ x: 2, y: 1 });
  });

  test('keeps structured text input focused after clicking the same caret position', async ({ page }) => {
    const viewport = { offset: { x: 180, y: 130 }, zoom: 1 };
    const textNode = {
      id: 'text-1', type: 'text', order: 1,
      position: { x: 2, y: 2 }, text: 'Edit',
      style: { color: '#111827' },
    };
    await seedSession(page, {
      id: 'structured-text-e2e', name: 'Structured Text E2E', mode: 'structured',
      scene: [textNode], components: [], grid: [], viewport,
    });
    const box = await page.getByTestId('ascii-canvas-surface').boundingBox();
    expect(box).not.toBeNull();
    const caret = {
      x: box!.x + viewport.offset.x + 3 * CELL_WIDTH,
      y: box!.y + viewport.offset.y + 2 * CELL_HEIGHT,
    };

    await page.mouse.dblclick(caret.x, caret.y);
    await page.keyboard.type('A');
    await expect.poll(async () => {
      const state = await readPersistedState(page);
      return state.structuredScene.find(
        (item: { id: string }) => item.id === textNode.id,
      )?.text as string;
    }).toContain('A');
    const afterFirstState = await readPersistedState(page);
    const afterFirstInput = afterFirstState.structuredScene.find(
      (item: { id: string }) => item.id === textNode.id,
    )?.text as string;

    await page.mouse.click(caret.x, caret.y);
    await page.keyboard.type('B');
    await expect.poll(async () => {
      const state = await readPersistedState(page);
      return state.structuredScene.find(
        (item: { id: string }) => item.id === textNode.id,
      )?.text as string;
    }).toContain('B');
    expect(afterFirstInput).not.toContain('B');
  });

  test('keeps animation viewport fixed during drag and advances frames', async ({ page }) => {
    const viewport = { offset: { x: 180, y: 130 }, zoom: 1 };
    const frames = [
      { id: 'frame-1', name: 'Frame 1', grid: [] },
      { id: 'frame-2', name: 'Frame 2', grid: [] },
    ];
    await seedSession(page, {
      id: 'animation-e2e', name: 'Animation E2E', mode: 'animation',
      scene: [], grid: [], size: { width: 20, height: 10 }, viewport,
      timeline: {
        frames, currentFrameId: frames[0].id, fps: 12, loop: true,
        onionSkin: { enabled: true, backwardLayers: 1, forwardLayers: 1, opacityFalloff: [0.5] },
      },
    });
    const box = await page.getByTestId('ascii-canvas-surface').boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + 500, box!.y + 300);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(box!.x + 560, box!.y + 340);
    await page.mouse.up({ button: 'middle' });

    const afterDrag = await readPersistedState(page);
    expect(afterDrag.offset).toEqual(viewport.offset);
    await page.getByRole('button', { name: 'Next frame' }).click();
    await expect.poll(async () => {
      const state = await readPersistedState(page);
      return state.animationTimeline.currentFrameId;
    }).toBe('frame-2');
  });
});
