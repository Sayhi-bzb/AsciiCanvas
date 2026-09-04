export const CANVAS_MEMORY_SCHEMA = 1;

export const CANVAS_MEMORY_THRESHOLDS = Object.freeze({
  maxReleasedHeapResidualBytes: 2 * 1024 * 1024,
  maxReleasedHeapResidualRatio: 0.1,
  maxDomNodeResidual: 32,
  maxListenerResidual: 4,
  maxCycleHeapSlopeBytes: 256 * 1024,
  maxComparisonRegressionBytes: 1024 * 1024,
  maxComparisonRegressionRatio: 0.05,
});

export type MemoryCheckpointName =
  | "baselineAfterGc"
  | "loadedAfterGc"
  | "retainedAfterGc"
  | "releasedAfterGc";

export type CanvasMemoryCheckpoint = {
  heapUsedBytes: number;
  heapTotalBytes: number;
  embedderHeapUsedBytes: number;
  backingStorageBytes: number;
  documents: number;
  nodes: number;
  jsEventListeners: number;
  canvasBackingBytes: number;
  engine: Readonly<Record<string, number>>;
};

export type CanvasMemoryRun = {
  checkpoints: Record<MemoryCheckpointName, CanvasMemoryCheckpoint>;
  interactionPeakHeapBytes: number;
  cycleRetainedHeapBytes: number[];
};

export type Distribution = {
  samples: number;
  min: number;
  median: number;
  p95: number;
};

export type CanvasMemorySummary = {
  loadedRetainedDeltaBytes: Distribution;
  retainedDeltaBytes: Distribution;
  interactionPeakDeltaBytes: Distribution;
  releasedResidualBytes: Distribution;
  reclaimRatio: Distribution;
  domNodeResidual: Distribution;
  listenerResidual: Distribution;
  cycleHeapSlopeBytes: Distribution;
};

export type CanvasMemoryWorkload = {
  id: string;
  label: string;
  description: string;
  runs: CanvasMemoryRun[];
  summary: CanvasMemorySummary;
  passed: boolean;
  failures: string[];
};

export type CanvasMemoryReport = {
  schemaVersion: number;
  generatedAt: string;
  label?: string;
  gitCommit: string;
  gitDirty: boolean;
  scope: "page-engine";
  exclusions: readonly string[];
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
  settings: {
    measuredRuns: number;
    sampleIntervalMs: number;
    gcPasses: number;
  };
  thresholds: typeof CANVAS_MEMORY_THRESHOLDS;
  workloads: CanvasMemoryWorkload[];
};

export const percentile = (values: readonly number[], ratio: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[Math.max(0, index)]!;
};

export const summarize = (values: readonly number[]): Distribution => ({
  samples: values.length,
  min: values.length ? Math.min(...values) : 0,
  median: percentile(values, 0.5),
  p95: percentile(values, 0.95),
});

export const linearSlope = (values: readonly number[]) => {
  if (values.length < 2) return 0;
  const meanX = (values.length - 1) / 2;
  const meanY = values.reduce((sum, value) => sum + value, 0) / values.length;
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    const deltaX = index - meanX;
    numerator += deltaX * (value - meanY);
    denominator += deltaX * deltaX;
  });
  return denominator === 0 ? 0 : numerator / denominator;
};

const deriveRun = (run: CanvasMemoryRun) => {
  const { baselineAfterGc, loadedAfterGc, retainedAfterGc, releasedAfterGc } =
    run.checkpoints;
  const retainedDelta = retainedAfterGc.heapUsedBytes - baselineAfterGc.heapUsedBytes;
  const reclaimed = retainedAfterGc.heapUsedBytes - releasedAfterGc.heapUsedBytes;
  return {
    loadedRetainedDeltaBytes:
      loadedAfterGc.heapUsedBytes - baselineAfterGc.heapUsedBytes,
    retainedDeltaBytes: retainedDelta,
    interactionPeakDeltaBytes:
      run.interactionPeakHeapBytes - baselineAfterGc.heapUsedBytes,
    releasedResidualBytes:
      releasedAfterGc.heapUsedBytes - baselineAfterGc.heapUsedBytes,
    reclaimRatio: retainedDelta > 0 ? reclaimed / retainedDelta : 1,
    domNodeResidual: releasedAfterGc.nodes - baselineAfterGc.nodes,
    listenerResidual:
      releasedAfterGc.jsEventListeners - baselineAfterGc.jsEventListeners,
    cycleHeapSlopeBytes: linearSlope(run.cycleRetainedHeapBytes),
  };
};

export const summarizeCanvasMemoryRuns = (
  runs: readonly CanvasMemoryRun[]
): CanvasMemorySummary => {
  const derived = runs.map(deriveRun);
  return {
    loadedRetainedDeltaBytes: summarize(derived.map((value) => value.loadedRetainedDeltaBytes)),
    retainedDeltaBytes: summarize(derived.map((value) => value.retainedDeltaBytes)),
    interactionPeakDeltaBytes: summarize(derived.map((value) => value.interactionPeakDeltaBytes)),
    releasedResidualBytes: summarize(derived.map((value) => value.releasedResidualBytes)),
    reclaimRatio: summarize(derived.map((value) => value.reclaimRatio)),
    domNodeResidual: summarize(derived.map((value) => value.domNodeResidual)),
    listenerResidual: summarize(derived.map((value) => value.listenerResidual)),
    cycleHeapSlopeBytes: summarize(derived.map((value) => value.cycleHeapSlopeBytes)),
  };
};

export const evaluateCanvasMemoryRuns = (
  runs: readonly CanvasMemoryRun[]
) => {
  const summary = summarizeCanvasMemoryRuns(runs);
  const failures: string[] = [];
  const residualLimit = Math.max(
    CANVAS_MEMORY_THRESHOLDS.maxReleasedHeapResidualBytes,
    summary.retainedDeltaBytes.median *
      CANVAS_MEMORY_THRESHOLDS.maxReleasedHeapResidualRatio
  );
  if (summary.releasedResidualBytes.median > residualLimit) {
    failures.push("released-heap-residual");
  }
  if (summary.domNodeResidual.median > CANVAS_MEMORY_THRESHOLDS.maxDomNodeResidual) {
    failures.push("dom-node-residual");
  }
  if (summary.listenerResidual.median > CANVAS_MEMORY_THRESHOLDS.maxListenerResidual) {
    failures.push("listener-residual");
  }
  if (summary.cycleHeapSlopeBytes.median > CANVAS_MEMORY_THRESHOLDS.maxCycleHeapSlopeBytes) {
    failures.push("cycle-heap-slope");
  }
  for (const run of runs) {
    for (const checkpoint of Object.values(run.checkpoints)) {
      const used = checkpoint.engine.projectionCacheBudgetBytes ?? 0;
      const limit = checkpoint.engine.projectionCacheBudgetLimit ?? Infinity;
      if (used > limit) failures.push("projection-budget");
    }
    const baseline = run.checkpoints.baselineAfterGc.engine;
    const released = run.checkpoints.releasedAfterGc.engine;
    for (const key of ["documents", "pages", "residentPageIndexes", "projectionCacheEntries"] as const) {
      if ((released[key] ?? 0) !== (baseline[key] ?? 0)) {
        failures.push(`released-${key}`);
      }
    }
  }
  return { summary, failures: [...new Set(failures)] };
};

const mib = (value: number) => `${(value / 1024 / 1024).toFixed(2)} MiB`;

export const createCanvasMemoryMarkdown = (report: CanvasMemoryReport) => {
  const lines = [
    "# Canvas memory report",
    "",
    `Generated: ${report.generatedAt}`,
    ...(report.label ? [`Label: ${report.label}`] : []),
    `Commit: \`${report.gitCommit}\`${report.gitDirty ? " (dirty)" : ""}`,
    `Scope: ${report.scope}; excludes ${report.exclusions.join(", ")}.`,
    `Sampling: ${report.settings.measuredRuns} runs, ${report.settings.sampleIntervalMs} ms peak interval, ${report.settings.gcPasses} GC passes per retained checkpoint.`,
    "",
    "| Workload | Result | Loaded retained | Interaction peak | Retained | Released residual | Reclaimed | DOM / listeners residual | Churn slope |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const workload of report.workloads) {
    const summary = workload.summary;
    lines.push(
      `| ${workload.label} | ${workload.passed ? "pass" : `fail: ${workload.failures.join(", ")}`} | ${mib(summary.loadedRetainedDeltaBytes.median)} | ${mib(summary.interactionPeakDeltaBytes.p95)} | ${mib(summary.retainedDeltaBytes.median)} | ${mib(summary.releasedResidualBytes.median)} | ${(summary.reclaimRatio.median * 100).toFixed(1)}% | ${summary.domNodeResidual.median.toFixed(0)} / ${summary.listenerResidual.median.toFixed(0)} | ${mib(summary.cycleHeapSlopeBytes.median)}/cycle |`
    );
  }
  lines.push("");
  return lines.join("\n");
};
