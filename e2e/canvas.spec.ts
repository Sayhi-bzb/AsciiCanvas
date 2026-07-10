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
  return raw ? JSON.parse(raw).state : null;
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

  test('should have toolbar', async ({ page }) => {
    // Toolbar buttons should be visible
    const toolbar = page.locator('[role="toolbar"]').first();
    await expect(toolbar).toBeVisible();
  });

  test('should create new session', async ({ page }) => {
    // Find and click new session button
    const newSessionButton = page.getByRole('button', { name: /new/i }).first();
    if (await newSessionButton.isVisible().catch(() => false)) {
      await newSessionButton.click();
      await page.getByRole('button', { name: 'New Freeform' }).click();

      await expect.poll(async () => {
        const state = await readPersistedState(page);
        return state?.canvasSessions?.length ?? 0;
      }).toBeGreaterThan(2);
    }
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
