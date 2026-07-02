import { expect, test, type Page, type TestInfo } from "@playwright/test";

type GridCell = {
  char: string;
  color: string;
  bgColor?: string;
};

type GridEntry = [string, GridCell];

type SmoothMetrics = {
  name: string;
  frameCount: number;
  avgFrameMs: number;
  p95FrameMs: number;
  maxFrameMs: number;
  over32ms: number;
  over50ms: number;
  longTaskCount: number;
  maxLongTaskMs: number;
};

const STORAGE_KEY = "ascii-canvas-persistence";
const CELL_WIDTH = 9;
const CELL_HEIGHT = 19;
const SCENARIO_MS = 5_000;
const INPUT_FRAME_MS = 16;
const LIMITS = {
  p95FrameMs: 24,
  maxOver50msFrames: 2,
};

const key = (x: number, y: number) => `${x},${y}`;

const makeGrid = (width: number, height: number): GridEntry[] => {
  const chars = "ASCII CANVAS PERF ";
  const entries: GridEntry[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isText = (x + y) % 5 === 0;
      const isBg = (x * 3 + y) % 11 === 0;
      if (!isText && !isBg) continue;

      entries.push([
        key(x, y),
        {
          char: isText ? chars[(x + y) % chars.length] : " ",
          color: "#111827",
          ...(isBg ? { bgColor: y % 2 ? "#dbeafe" : "#ecfeff" } : {}),
        },
      ]);
    }
  }

  return entries;
};

const makeStructuredScene = () => {
  const scene = [];
  let order = 1;

  for (let i = 0; i < 32; i++) {
    const x = 4 + (i % 4) * 26;
    const y = 4 + Math.floor(i / 4) * 8;
    scene.push({
      id: `bg-${i}`,
      type: "bg",
      order: order++,
      start: { x, y },
      end: { x: x + 21, y: y + 5 },
      style: { color: "#111827", bgColor: i % 2 ? "#fef3c7" : "#dbeafe" },
    });
    scene.push({
      id: `box-${i}`,
      type: "box",
      order: order++,
      start: { x, y },
      end: { x: x + 21, y: y + 5 },
      name: `CARD ${i}`,
      style: { color: "#111827" },
    });
    scene.push({
      id: `text-${i}`,
      type: "text",
      order: order++,
      position: { x: x + 2, y: y + 2 },
      text: `Metric ${i}\nBUTTON`,
      style: { color: i % 2 ? "#0f766e" : "#1d4ed8" },
    });
  }

  return scene;
};

const makeAnimationTimeline = () => {
  const frames = Array.from({ length: 18 }, (_, frameIndex) => ({
    id: `frame-${frameIndex}`,
    name: `Frame ${frameIndex + 1}`,
    grid: makeGrid(80, 25)
      .filter((_, index) => index % 4 === frameIndex % 4)
      .slice(0, 420),
  }));

  return {
    frames,
    currentFrameId: frames[0].id,
    fps: 24,
    loop: true,
    onionSkin: {
      enabled: true,
      backwardLayers: 2,
      forwardLayers: 2,
      opacityFalloff: [0.5, 0.3],
    },
  };
};

const makePersistedState = (
  mode: "freeform" | "structured" | "animation"
) => {
  const freeformGrid = makeGrid(180, 90);
  const structuredScene = makeStructuredScene();
  const animationTimeline = makeAnimationTimeline();
  const animationGrid = animationTimeline.frames[0].grid;
  const grid =
    mode === "animation"
      ? animationGrid
      : mode === "structured"
        ? []
        : freeformGrid;
  const session = {
    id: "perf-session",
    name: "Performance Seed",
    mode,
    scene: mode === "structured" ? structuredScene : [],
    grid,
    viewport: { offset: { x: 180, y: 130 }, zoom: 1 },
    ...(mode === "animation"
      ? { size: { width: 80, height: 25 }, timeline: animationTimeline }
      : {}),
  };

  return {
    state: {
      offset: session.viewport.offset,
      zoom: session.viewport.zoom,
      canvasMode: mode,
      structuredScene: mode === "structured" ? structuredScene : [],
      canvasBounds: mode === "animation" ? { width: 80, height: 25 } : null,
      animationTimeline: mode === "animation" ? animationTimeline : null,
      brushChar: "█",
      brushColor: "#111827",
      showGrid: true,
      exportShowGrid: false,
      canvasSessions: [session],
      activeCanvasId: session.id,
      grid,
    },
    version: 0,
  };
};

const seedCanvas = async (
  page: Page,
  mode: "freeform" | "structured" | "animation"
) => {
  const persisted = makePersistedState(mode);
  await page.addInitScript(
    ({ storageKey, value }) => {
      window.localStorage.clear();
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    },
    { storageKey: STORAGE_KEY, value: persisted }
  );
};

const openSeededCanvas = async (
  page: Page,
  mode: "freeform" | "structured" | "animation"
) => {
  const runtimeErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    runtimeErrors.push(error.message);
  });
  await seedCanvas(page, mode);
  await page.goto("/");
  await page.waitForSelector("canvas", { timeout: 10_000 }).catch((error) => {
    throw new Error(
      [
        error instanceof Error ? error.message : String(error),
        ...runtimeErrors.map((message) => `runtime: ${message}`),
      ].join("\n")
    );
  });
  await page.waitForTimeout(250);
};

const installSmoothProbe = async (page: Page) => {
  await page.evaluate(() => {
    const state = {
      frames: [] as number[],
      longTasks: [] as number[],
      rafId: 0,
      observer: null as PerformanceObserver | null,
    };
    let last = performance.now();

    state.observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        state.longTasks.push(entry.duration);
      }
    });
    try {
      state.observer.observe({ entryTypes: ["longtask"] });
    } catch {
      state.observer = null;
    }

    const tick = (now: number) => {
      state.frames.push(now - last);
      last = now;
      state.rafId = requestAnimationFrame(tick);
    };
    state.rafId = requestAnimationFrame(tick);
    window.__asciiPerf = state;
  });
};

const readSmoothProbe = async (page: Page, name: string): Promise<SmoothMetrics> =>
  page.evaluate((scenarioName) => {
    const state = window.__asciiPerf;
    cancelAnimationFrame(state.rafId);
    state.observer?.disconnect();
    const frames = state.frames.slice(1);
    const sorted = [...frames].sort((a, b) => a - b);
    const percentile = (p: number) =>
      sorted.length
        ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
        : 0;
    const longTasks = state.longTasks;

    return {
      name: scenarioName,
      frameCount: frames.length,
      avgFrameMs:
        frames.reduce((sum, value) => sum + value, 0) /
        Math.max(frames.length, 1),
      p95FrameMs: percentile(0.95),
      maxFrameMs: Math.max(0, ...frames),
      over32ms: frames.filter((value) => value > 32).length,
      over50ms: frames.filter((value) => value > 50).length,
      longTaskCount: longTasks.length,
      maxLongTaskMs: Math.max(0, ...longTasks),
    };
  }, name);

const runSmoothScenario = async (
  page: Page,
  name: string,
  action: () => Promise<void>,
  testInfo: TestInfo
) => {
  await installSmoothProbe(page);
  await action();
  await page.waitForTimeout(300);
  const metrics = await readSmoothProbe(page, name);
  await testInfo.attach(`${name}.json`, {
    body: JSON.stringify(metrics, null, 2),
    contentType: "application/json",
  });

  expect(metrics.frameCount, `${name} should capture enough frames`).toBeGreaterThan(30);
  expect(metrics.p95FrameMs, `${name} p95 frame interval`).toBeLessThanOrEqual(
    LIMITS.p95FrameMs
  );
  expect(metrics.over50ms, `${name} >50ms frames`).toBeLessThanOrEqual(
    LIMITS.maxOver50msFrames
  );
  return metrics;
};

const dragFor = async (
  page: Page,
  start: { x: number; y: number },
  delta: { x: number; y: number },
  options: { button?: "left" | "middle"; durationMs?: number } = {}
) => {
  const button = options.button ?? "left";
  const durationMs = options.durationMs ?? SCENARIO_MS;
  const startedAt = Date.now();
  let step = 0;

  await page.mouse.move(start.x, start.y);
  await page.mouse.down({ button });
  while (Date.now() - startedAt < durationMs) {
    const t = step / 16;
    await page.mouse.move(
      start.x + Math.sin(t) * delta.x,
      start.y + Math.cos(t * 0.7) * delta.y
    );
    step += 1;
    await page.waitForTimeout(INPUT_FRAME_MS);
  }
  await page.mouse.up({ button });
};

const wheelFor = async (
  page: Page,
  options: { ctrl?: boolean; durationMs?: number } = {}
) => {
  const durationMs = options.durationMs ?? SCENARIO_MS;
  const startedAt = Date.now();
  let step = 0;

  if (options.ctrl) await page.keyboard.down("Control");
  while (Date.now() - startedAt < durationMs) {
    await page.mouse.wheel(
      options.ctrl ? 0 : step % 2 ? 26 : -18,
      options.ctrl ? (step % 2 ? 80 : -80) : 34
    );
    step += 1;
    await page.waitForTimeout(INPUT_FRAME_MS);
  }
  if (options.ctrl) await page.keyboard.up("Control");
};

test.describe.serial("Performance smoke", () => {
  test("startup resource budget", async ({ page }, testInfo) => {
    await openSeededCanvas(page, "freeform");

    const summary = await page.evaluate(() => {
      const resources = performance.getEntriesByType(
        "resource"
      ) as PerformanceResourceTiming[];
      const scripts = resources
        .filter((entry) => entry.initiatorType === "script")
        .map((entry) => ({
          name: entry.name.split("/").pop() ?? entry.name,
          encodedBodySize: entry.encodedBodySize,
          transferSize: entry.transferSize,
        }));
      const json = resources
        .filter((entry) => entry.name.includes("/data/"))
        .map((entry) => ({
          name: entry.name.split("/").pop() ?? entry.name,
          encodedBodySize: entry.encodedBodySize,
          transferSize: entry.transferSize,
        }));
      const largestScript = scripts.reduce(
        (largest, entry) =>
          entry.encodedBodySize > largest.encodedBodySize ? entry : largest,
        { name: "", encodedBodySize: 0, transferSize: 0 }
      );

      return {
        domNodes: document.querySelectorAll("*").length,
        canvasCount: document.querySelectorAll("canvas").length,
        scriptCount: scripts.length,
        largestScript,
        json,
        localStorageBytes: Object.entries(localStorage).reduce(
          (sum, [key, value]) => sum + key.length + value.length,
          0
        ),
      };
    });

    await testInfo.attach("startup-resources.json", {
      body: JSON.stringify(summary, null, 2),
      contentType: "application/json",
    });

    expect(summary.canvasCount).toBeGreaterThanOrEqual(3);
    expect(summary.largestScript.encodedBodySize).toBeLessThanOrEqual(500_000);
  });

  test("freeform pan, wheel, and zoom stay smooth", async ({ page }, testInfo) => {
    await openSeededCanvas(page, "freeform");

    const pan = await runSmoothScenario(
      page,
      "freeform-pan",
      () => dragFor(page, { x: 720, y: 450 }, { x: 260, y: 120 }, { button: "middle" }),
      testInfo
    );
    const wheel = await runSmoothScenario(
      page,
      "freeform-wheel-pan",
      () => wheelFor(page),
      testInfo
    );
    const zoom = await runSmoothScenario(
      page,
      "freeform-ctrl-wheel-zoom",
      () => wheelFor(page, { ctrl: true }),
      testInfo
    );

    await testInfo.attach("freeform-summary.json", {
      body: JSON.stringify([pan, wheel, zoom], null, 2),
      contentType: "application/json",
    });
  });

  test("structured selection and node drag stay smooth", async ({ page }, testInfo) => {
    await openSeededCanvas(page, "structured");

    const dragPoint = {
      x: 180 + 10 * CELL_WIDTH,
      y: 130 + 7 * CELL_HEIGHT,
    };
    const selection = await runSmoothScenario(
      page,
      "structured-selection",
      () => dragFor(page, { x: 70, y: 90 }, { x: 70, y: 36 }),
      testInfo
    );
    const nodeDrag = await runSmoothScenario(
      page,
      "structured-node-drag",
      () => dragFor(page, dragPoint, { x: 120, y: 64 }),
      testInfo
    );

    await testInfo.attach("structured-summary.json", {
      body: JSON.stringify([selection, nodeDrag], null, 2),
      contentType: "application/json",
    });
  });

  test("animation playback and frame controls stay smooth", async ({ page }, testInfo) => {
    await openSeededCanvas(page, "animation");

    const playButton = page.getByRole("button", { name: "Play animation" });
    await expect(playButton).toBeVisible();
    const playback = await runSmoothScenario(
      page,
      "animation-playback",
      async () => {
        await playButton.click();
        await page.waitForTimeout(SCENARIO_MS);
        await page.getByRole("button", { name: "Pause animation" }).click();
      },
      testInfo
    );
    const frameStep = await runSmoothScenario(
      page,
      "animation-frame-step",
      async () => {
        const next = page.getByRole("button", { name: "Next frame" });
        for (let i = 0; i < 80; i++) {
          await next.click();
        }
      },
      testInfo
    );

    await testInfo.attach("animation-summary.json", {
      body: JSON.stringify([playback, frameStep], null, 2),
      contentType: "application/json",
    });
  });
});

declare global {
  interface Window {
    __asciiPerf: {
      frames: number[];
      longTasks: number[];
      rafId: number;
      observer: PerformanceObserver | null;
    };
  }
}
