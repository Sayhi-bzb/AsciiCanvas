import { describe, expect, it, vi } from "vitest";
import {
  createDragResetController,
  executeDragReset,
  type DragResetExecutor,
} from "@/widgets/canvas-editor/hooks/interaction/gestures/dragResetExecution";
import type { StructuredPreviewQueueController } from "@/widgets/canvas-editor/hooks/interaction/structured/structuredPreviewQueueExecution";

const createExecutor = (calls: string[]): DragResetExecutor => ({
  clearStructuredMoveQueueLast: vi.fn(() =>
    calls.push("clearStructuredMoveQueueLast")
  ),
  clearStructuredSplitBoxResizeQueueLast: vi.fn(() =>
    calls.push("clearStructuredSplitBoxResizeQueueLast")
  ),
  clearStructuredMovePreview: vi.fn(() =>
    calls.push("clearStructuredMovePreview")
  ),
  dispatchInteraction: vi.fn(() => calls.push("dispatchInteraction")),
});

const createStructuredPreviewQueue = (
  calls: string[]
): StructuredPreviewQueueController => ({
  queueMove: vi.fn(),
  queueSplitBoxResize: vi.fn(),
  flushMove: vi.fn(),
  flushSplitBoxResize: vi.fn(),
  clearLastMove: vi.fn(() => calls.push("clearLastMove")),
  clearLastSplitBoxResize: vi.fn(() => calls.push("clearLastSplitBoxResize")),
  cancel: vi.fn(),
});

describe("drag reset execution", () => {
  it("clears transient drag state before resetting interaction state", () => {
    const calls: string[] = [];
    const executor = createExecutor(calls);

    executeDragReset(executor);

    expect(calls).toEqual([
      "clearStructuredMoveQueueLast",
      "clearStructuredSplitBoxResizeQueueLast",
      "clearStructuredMovePreview",
      "dispatchInteraction",
    ]);
    expect(executor.dispatchInteraction).toHaveBeenCalledWith({ type: "reset" });
  });

  it("controller clears structured preview state and resets typed state", () => {
    const calls: string[] = [];
    const structuredPreviewQueue = createStructuredPreviewQueue(calls);
    const clearStructuredMovePreview = vi.fn(() =>
      calls.push("clearStructuredMovePreview")
    );
    const dispatchInteraction = vi.fn(() => calls.push("dispatchInteraction"));

    createDragResetController({
      structuredPreviewQueue,
      clearStructuredMovePreview,
      dispatchInteraction,
    }).reset();

    expect(calls).toEqual([
      "clearLastMove",
      "clearLastSplitBoxResize",
      "clearStructuredMovePreview",
      "dispatchInteraction",
    ]);
    expect(dispatchInteraction).toHaveBeenCalledWith({ type: "reset" });
  });
});
