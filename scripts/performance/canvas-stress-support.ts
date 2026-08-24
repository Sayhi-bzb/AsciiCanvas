export const CANVAS_STRESS_THRESHOLDS = Object.freeze({
  p95FrameMs: 24,
  maxOver50msFrames: 2,
  maxInputPaintMs: 100,
});

export type CanvasStressMetrics = {
  frameCount: number;
  avgFrameMs: number;
  p95FrameMs: number;
  maxFrameMs: number;
  over32ms: number;
  over50ms: number;
  longTaskCount: number;
  maxLongTaskMs: number;
  inputPaintMs: number | null;
  jsHeapBytes: number | null;
  canvasBackingBytes: number;
  localStorageBytes: number;
};

export type CanvasStressLevel = {
  family: "freeform-sparse" | "freeform-dense" | "zoom" | "structured" | "persistence";
  label: string;
  cellCount?: number;
  nodeCount?: number;
  projectedCellCount?: number | null;
  zoom: number;
  snapshotBytes: number;
  persistenceMs?: number | null;
  storageError?: string | null;
  runtimeErrors: readonly string[];
  metrics: CanvasStressMetrics | null;
  passed: boolean;
  failures: readonly string[];
};

export type CanvasStressReport = {
  generatedAt: string;
  environment: {
    platform: string;
    architecture: string;
    cpu: string;
    cpuCount: number;
    node: string;
    browser: string;
    viewport: { width: number; height: number };
    deviceScaleFactor: number;
  };
  thresholds: typeof CANVAS_STRESS_THRESHOLDS;
  levels: CanvasStressLevel[];
};

export const percentile = (values: readonly number[], ratio: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))]!;
};

export const evaluateCanvasStressLevel = ({
  metrics,
  runtimeErrors,
  storageError,
}: Pick<CanvasStressLevel, "metrics" | "runtimeErrors" | "storageError">) => {
  const failures: string[] = [];
  if (!metrics) failures.push("metrics-unavailable");
  if (metrics && metrics.p95FrameMs > CANVAS_STRESS_THRESHOLDS.p95FrameMs) {
    failures.push("p95-frame");
  }
  if (metrics && metrics.over50ms > CANVAS_STRESS_THRESHOLDS.maxOver50msFrames) {
    failures.push("over-50ms-frames");
  }
  if (
    metrics?.inputPaintMs !== null &&
    metrics?.inputPaintMs !== undefined &&
    metrics.inputPaintMs > CANVAS_STRESS_THRESHOLDS.maxInputPaintMs
  ) {
    failures.push("input-paint");
  }
  if (metrics && metrics.inputPaintMs === null) failures.push("input-paint-unavailable");
  if (runtimeErrors.length > 0) failures.push("runtime-error");
  if (storageError) failures.push("storage-error");
  return failures;
};

const formatBytes = (bytes: number | null | undefined) => {
  if (bytes === null || bytes === undefined) return "—";
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
};

const formatNumber = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined ? "—" : value.toFixed(digits);

export const summarizeCanvasStressFamilies = (levels: readonly CanvasStressLevel[]) => {
  const families = [...new Set(levels.map((level) => level.family))];
  return families.map((family) => {
    const familyLevels = levels.filter((level) => level.family === family);
    const lastPassing = [...familyLevels].reverse().find((level) => level.passed) ?? null;
    const firstFailure = familyLevels.find((level) => !level.passed) ?? null;
    return { family, lastPassing, firstFailure };
  });
};

export const createCanvasStressMarkdown = (report: CanvasStressReport) => {
  const lines = [
    "# Canvas stress report",
    "",
    `Generated: ${report.generatedAt}`,
    `Environment: ${report.environment.browser}; ${report.environment.cpuCount} × ${report.environment.cpu}; ${report.environment.platform}/${report.environment.architecture}`,
    `Viewport: ${report.environment.viewport.width} × ${report.environment.viewport.height} at DPR ${report.environment.deviceScaleFactor}`,
    "",
    "## Boundaries",
    "",
    "| Family | Last passing | First failure | Reason |",
    "| --- | --- | --- | --- |",
  ];

  summarizeCanvasStressFamilies(report.levels).forEach(({ family, lastPassing, firstFailure }) => {
    lines.push(
      `| ${family} | ${lastPassing?.label ?? "none"} | ${firstFailure?.label ?? "not reached"} | ${firstFailure?.failures.join(", ") || "—"} |`
    );
  });

  lines.push(
    "",
    "## Levels",
    "",
    "| Family | Level | Result | p95 frame | >50ms | Input paint | Heap | Canvas | Snapshot | Persistence |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"
  );
  report.levels.forEach((level) => {
    lines.push(
      `| ${level.family} | ${level.label} | ${level.passed ? "pass" : `fail: ${level.failures.join(", ")}`} | ${formatNumber(level.metrics?.p95FrameMs)} ms | ${level.metrics?.over50ms ?? "—"} | ${formatNumber(level.metrics?.inputPaintMs)} ms | ${formatBytes(level.metrics?.jsHeapBytes)} | ${formatBytes(level.metrics?.canvasBackingBytes)} | ${formatBytes(level.snapshotBytes)} | ${formatNumber(level.persistenceMs)} ms |`
    );
  });
  lines.push("");
  return lines.join("\n");
};
