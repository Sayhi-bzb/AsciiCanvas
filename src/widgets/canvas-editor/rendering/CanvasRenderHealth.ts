import type { CanvasRasterTileStats } from "./CanvasRasterTileCache";
import type { CanvasRenderWorkerStats } from "./CanvasRenderWorkerClient";
import type { CanvasMemoryGovernor } from "./CanvasMemoryGovernor";

type CanvasResourceSnapshot = {
  memory: ReturnType<CanvasMemoryGovernor["getStats"]>;
  projection: {
    bytes: number;
    byteBudget: number;
    entries: number;
    evictions: number;
  };
  raster: CanvasRasterTileStats;
  worker: CanvasRenderWorkerStats;
};

type CanvasRenderHealth = {
  status: "healthy" | "degraded";
  issues: readonly string[];
};

export const evaluateCanvasRenderHealth = (
  snapshot: CanvasResourceSnapshot
): CanvasRenderHealth => {
  const { memory, raster, worker } = snapshot;
  const issues: string[] = [];
  if (memory.pressure !== "normal") {
    issues.push(`memory-pressure-${memory.pressure}`);
  }
  if (raster.bytes > raster.memoryBudget) issues.push("raster-memory-over-budget");
  if (memory.usage["cell-plane"] > memory.limits["cell-plane"]) {
    issues.push("cell-plane-memory-over-budget");
  }
  if (memory.usage["worker-source"] > memory.limits["worker-source"]) {
    issues.push("worker-source-memory-over-budget");
  }
  if (worker.pending > Math.max(4, worker.workers * 2)) {
    issues.push("worker-queue-saturated");
  }
  if (worker.maxQueueLatencyMs > 1_000) issues.push("worker-queue-stalled");
  if (raster.staleEntries > Math.max(8, raster.entries / 2)) {
    issues.push("stale-raster-backlog");
  }
  return { status: issues.length === 0 ? "healthy" : "degraded", issues };
};
