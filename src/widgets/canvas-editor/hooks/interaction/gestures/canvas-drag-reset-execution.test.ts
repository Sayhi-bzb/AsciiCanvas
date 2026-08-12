import { describe, expect, it, vi } from "vitest";
import {
  createDragResetController,
  executeDragReset,
  type DragResetExecutor,
} from "@/widgets/canvas-editor/hooks/interaction/gestures/dragResetExecution";
import type { StructuredPreviewQueueController } from "@/widgets/canvas-editor/hooks/interaction/structured/structuredPreviewQueueExecution";
import type { SelectionPreviewController } from "@/widgets/canvas-editor/hooks/interaction/preview/selectionPreviewController";

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
  clearSelectionPreview: vi.fn(() => calls.push("clearSelectionPreview")),
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

const createSelectionPreview = (calls: string[]): SelectionPreviewController => ({
  get: vi.fn(() => null),
  set: vi.fn(() => calls.push("clearSelectionPreview")),
  flush: vi.fn(),
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
      "clearSelectionPreview",
    ]);
  });

  it("controller clears structured preview state and resets typed state", () => {
    const calls: string[] = [];
    const structuredPreviewQueue = createStructuredPreviewQueue(calls);
    const selectionPreview = createSelectionPreview(calls);
    const clearStructuredMovePreview = vi.fn(() =>
      calls.push("clearStructuredMovePreview")
    );

    createDragResetController({
      structuredPreviewQueue,
      clearStructuredMovePreview,
      selectionPreview,
    }).reset();

    expect(calls).toEqual([
      "clearLastMove",
      "clearLastSplitBoxResize",
      "clearStructuredMovePreview",
      "clearSelectionPreview",
    ]);
    expect(selectionPreview.set).toHaveBeenCalledWith(null, {
      immediate: true,
    });
  });
});
