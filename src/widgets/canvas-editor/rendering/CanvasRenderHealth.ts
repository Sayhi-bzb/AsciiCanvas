import type { CanvasRasterTileStats } from "./CanvasRasterTileCache";
import type { CanvasRenderWorkerStats } from "./CanvasRenderWorkerClient";

type CanvasRenderHealth = {
  status: "healthy" | "degraded";
  issues: readonly string[];
};

export const evaluateCanvasRenderHealth = (
  raster: CanvasRasterTileStats,
  worker: CanvasRenderWorkerStats
): CanvasRenderHealth => {
  const issues: string[] = [];
  if (raster.bytes > raster.memoryBudget) issues.push("raster-memory-over-budget");
  if (worker.pending > Math.max(4, worker.workers * 2)) issues.push("worker-queue-saturated");
  if (worker.maxQueueLatencyMs > 1_000) issues.push("worker-queue-stalled");
  if (raster.staleEntries > Math.max(8, raster.entries / 2)) {
    issues.push("stale-raster-backlog");
  }
  return { status: issues.length === 0 ? "healthy" : "degraded", issues };
};
