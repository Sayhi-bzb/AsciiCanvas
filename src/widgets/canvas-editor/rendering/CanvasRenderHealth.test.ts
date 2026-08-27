import { describe, expect, it } from "vitest";
import { evaluateCanvasRenderHealth } from "./CanvasRenderHealth";

const snapshot = () => ({
  memory: {
    pressure: "normal",
    usage: { raster: 10, "cell-plane": 10, "worker-source": 10 },
    limits: { raster: 20, "cell-plane": 20, "worker-source": 20 },
  },
  projection: { bytes: 10, byteBudget: 20, entries: 1, evictions: 0 },
  raster: { bytes: 10, memoryBudget: 20, staleEntries: 0, entries: 1 },
  worker: { pending: 0, workers: 1, maxQueueLatencyMs: 20 },
}) as never;

describe("evaluateCanvasRenderHealth", () => {
  it("reports saturated worker queues", () => {
    const input = snapshot() as unknown as {
      worker: { pending: number };
    };
    input.worker.pending = 6;
    const health = evaluateCanvasRenderHealth(input as never);
    expect(health).toEqual({
      status: "degraded",
      issues: ["worker-queue-saturated"],
    });
  });

  it("reports unified memory pressure and category overflow", () => {
    const input = snapshot() as unknown as {
      memory: {
        pressure: string;
        usage: Record<string, number>;
      };
    };
    input.memory.pressure = "critical";
    input.memory.usage["worker-source"] = 30;
    expect(evaluateCanvasRenderHealth(input as never).issues).toEqual([
      "memory-pressure-critical",
      "worker-source-memory-over-budget",
    ]);
  });
});
