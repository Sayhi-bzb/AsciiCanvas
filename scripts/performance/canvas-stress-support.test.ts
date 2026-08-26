import { describe, expect, it } from "vitest";
import {
  createCanvasStressMarkdown,
  evaluateCanvasStressLevel,
  percentile,
  type CanvasStressMetrics,
  type CanvasStressReport,
} from "./canvas-stress-support";

const metrics = (overrides: Partial<CanvasStressMetrics> = {}): CanvasStressMetrics => ({
  frameCount: 300,
  avgFrameMs: 16.7,
  p95FrameMs: 20,
  p99FrameMs: 24,
  maxFrameMs: 30,
  over32ms: 0,
  over50ms: 0,
  longTaskCount: 0,
  maxLongTaskMs: 0,
  longAnimationFrameCount: 0,
  maxLongAnimationFrameMs: 0,
  maxBlockingDurationMs: 0,
  inputPaintMs: 34,
  jsHeapBytes: 1_000_000,
  canvasBackingBytes: 2_000_000,
  localStorageBytes: 3_000_000,
  ...overrides,
});

describe("canvas stress support", () => {
  it("uses a deterministic nearest-rank percentile", () => {
    expect(percentile([30, 10, 20, 40], 0.5)).toBe(30);
    expect(percentile([], 0.95)).toBe(0);
  });

  it("classifies every strict threshold independently", () => {
    expect(evaluateCanvasStressLevel({
      metrics: metrics({
        p95FrameMs: 25,
        over50ms: 3,
        inputPaintMs: 101,
        jsHeapBytes: 300 * 1024 * 1024,
      }),
      runtimeErrors: ["page crashed"],
      storageError: "quota",
    })).toEqual([
      "p95-frame",
      "over-50ms-frames",
      "input-paint",
      "js-heap",
      "runtime-error",
      "storage-error",
    ]);
  });

  it("renders passing and failing boundaries in the report", () => {
    const report: CanvasStressReport = {
      generatedAt: "2026-08-23T00:00:00.000Z",
      environment: {
        platform: "test",
        architecture: "test",
        cpu: "test",
        cpuCount: 1,
        node: "test",
        browser: "Chromium",
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
      },
      thresholds: {
        p95FrameMs: 24,
        maxOver50msFrames: 2,
        maxInputPaintMs: 100,
        maxJsHeapBytes: 256 * 1024 * 1024,
      },
      levels: [
        {
          family: "freeform-dense",
          label: "5k cells",
          cellCount: 5_000,
          zoom: 1,
          snapshotBytes: 10,
          runtimeErrors: [],
          metrics: metrics(),
          passed: true,
          failures: [],
        },
        {
          family: "freeform-dense",
          label: "10k cells",
          cellCount: 10_000,
          zoom: 1,
          snapshotBytes: 20,
          runtimeErrors: [],
          metrics: metrics({ p95FrameMs: 25 }),
          passed: false,
          failures: ["p95-frame"],
        },
      ],
    };

    const markdown = createCanvasStressMarkdown(report);
    expect(markdown).toContain("| freeform-dense | 5k cells | 10k cells | p95-frame |");
    expect(markdown).toContain("fail: p95-frame");
  });
});
