import { describe, expect, it } from "vitest";
import { evaluateCanvasRenderHealth } from "./CanvasRenderHealth";

describe("evaluateCanvasRenderHealth", () => {
  it("reports saturated worker queues", () => {
    const health = evaluateCanvasRenderHealth(
      { bytes: 10, memoryBudget: 20, staleEntries: 0, entries: 1 } as never,
      { pending: 6, workers: 1, maxQueueLatencyMs: 20 } as never
    );
    expect(health).toEqual({
      status: "degraded",
      issues: ["worker-queue-saturated"],
    });
  });
});
