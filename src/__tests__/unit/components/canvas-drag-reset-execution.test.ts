import { describe, expect, it, vi } from "vitest";
import {
  createDragResetController,
  executeDragReset,
  type DragResetExecutor,
} from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/gestures/dragResetExecution";
import type { StructuredPreviewQueueController } from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/structured/structuredPreviewQueueExecution";

const createExecutor = (calls: string[]): DragResetExecutor => ({
  clearDragStartGrid: vi.fn(() => calls.push("clearDragStartGrid")),
  clearLastGrid: vi.fn(() => calls.push("clearLastGrid")),
  clearLastPlacedGrid: vi.fn(() => calls.push("clearLastPlacedGrid")),
  clearLineAxis: vi.fn(() => calls.push("clearLineAxis")),
  clearStructuredNodeDrag: vi.fn(() => calls.push("clearStructuredNodeDrag")),
  clearStructuredMoveQueueLast: vi.fn(() =>
    calls.push("clearStructuredMoveQueueLast")
  ),
  clearStructuredSplitBoxResizeQueueLast: vi.fn(() =>
    calls.push("clearStructuredSplitBoxResizeQueueLast")
  ),
  clearStructuredMovePreview: vi.fn(() =>
    calls.push("clearStructuredMovePreview")
  ),
  clearStructuredTextSelectionStart: vi.fn(() =>
    calls.push("clearStructuredTextSelectionStart")
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
      "clearDragStartGrid",
      "clearLastGrid",
      "clearLastPlacedGrid",
      "clearLineAxis",
      "clearStructuredNodeDrag",
      "clearStructuredMoveQueueLast",
      "clearStructuredSplitBoxResizeQueueLast",
      "clearStructuredMovePreview",
      "clearStructuredTextSelectionStart",
      "dispatchInteraction",
    ]);
    expect(executor.dispatchInteraction).toHaveBeenCalledWith({ type: "reset" });
  });

  it("controller clears hook refs and structured preview queue state", () => {
    const calls: string[] = [];
    const dragStartGrid = { current: { x: 1, y: 2 } };
    const lastGrid = { current: { x: 3, y: 4 } };
    const lastPlacedGrid = { current: { x: 5, y: 6 } };
    const lineAxis = { current: "vertical" as "vertical" | "horizontal" | null };
    const structuredNodeDrag = { current: null };
    const structuredTextSelectionStart = {
      current: { nodeId: "text-1", offset: 2 } as { nodeId: string; offset: number } | null,
    };
    const structuredPreviewQueue = createStructuredPreviewQueue(calls);
    const clearStructuredMovePreview = vi.fn(() =>
      calls.push("clearStructuredMovePreview")
    );
    const dispatchInteraction = vi.fn(() => calls.push("dispatchInteraction"));

    createDragResetController({
      refs: {
        dragStartGrid,
        lastGrid,
        lastPlacedGrid,
        lineAxis,
        structuredNodeDrag,
        structuredTextSelectionStart,
      },
      structuredPreviewQueue,
      clearStructuredMovePreview,
      dispatchInteraction,
    }).reset();

    expect(dragStartGrid.current).toBeNull();
    expect(lastGrid.current).toBeNull();
    expect(lastPlacedGrid.current).toBeNull();
    expect(lineAxis.current).toBeNull();
    expect(structuredNodeDrag.current).toBeNull();
    expect(structuredTextSelectionStart.current).toBeNull();
    expect(calls).toEqual([
      "clearLastMove",
      "clearLastSplitBoxResize",
      "clearStructuredMovePreview",
      "dispatchInteraction",
    ]);
    expect(dispatchInteraction).toHaveBeenCalledWith({ type: "reset" });
  });
});
