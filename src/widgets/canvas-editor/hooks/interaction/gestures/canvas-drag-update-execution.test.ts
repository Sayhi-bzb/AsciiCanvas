import { describe, expect, it, vi } from "vitest";
import {
  createDragUpdateExecutor,
  createDragUpdateHandler,
  createDragUpdateRouteHandler,
  createPanningDragUpdateExecutor,
  executeDragUpdateDecision,
} from "@/widgets/canvas-editor/hooks/interaction/gestures/dragUpdateExecution";
import type { DragUpdateExecutor } from "@/widgets/canvas-editor/hooks/interaction/gestures/dragUpdateExecution";
import type { StructuredPreviewQueueController } from "@/widgets/canvas-editor/hooks/interaction/structured/structuredPreviewQueueExecution";

const createExecutor = (): DragUpdateExecutor => ({
  dispatchInteraction: vi.fn(),
  setSelectionPreview: vi.fn(),
  draw: vi.fn(),
  queueStructuredMove: vi.fn(),
  queueStructuredSplitBoxResize: vi.fn(),
  updateStructuredNode: vi.fn(),
  setStructuredTextSelection: vi.fn(),
  setTextCursor: vi.fn(),
  updateScratchForShape: vi.fn(),
  setHoveredGrid: vi.fn(),
});

describe("canvas drag-update execution", () => {
  it("updates typed selection state and preview together", () => {
    const executor = createExecutor();
    executeDragUpdateDecision(
      { type: "selection-preview", preview: { start: { x: 1, y: 2 }, end: { x: 4, y: 5 } } },
      executor,
      { currentGrid: { x: 4, y: 5 }, tool: "select", structuredScene: [], updateEraserHover: false }
    );
    expect(executor.dispatchInteraction).toHaveBeenCalledWith({
      type: "updateSelection", current: { x: 4, y: 5 },
    });
    expect(executor.setSelectionPreview).toHaveBeenCalled();
  });

  it("dispatches shape axis transitions before updating scratch", () => {
    const executor = createExecutor();
    executeDragUpdateDecision({
      type: "shape-preview",
      update: {
        start: { x: 0, y: 0 }, end: { x: 1, y: 4 }, axis: "vertical",
        interactionEvent: { type: "setShapePreviewAxis", axis: "vertical" },
      },
    }, executor, {
      currentGrid: { x: 1, y: 4 }, tool: "line", structuredScene: [], updateEraserHover: false,
    });
    expect(executor.dispatchInteraction).toHaveBeenCalledWith({
      type: "setShapePreviewAxis", axis: "vertical",
    });
    expect(executor.updateScratchForShape).toHaveBeenCalledWith(
      "line", { x: 0, y: 0 }, { x: 1, y: 4 }, { axis: "vertical" }
    );
  });

  it("composes structured preview queues into the executor", () => {
    const queue: StructuredPreviewQueueController = {
      queueMove: vi.fn(), queueSplitBoxResize: vi.fn(),
      flushMove: vi.fn(), flushSplitBoxResize: vi.fn(),
      clearLastMove: vi.fn(), clearLastSplitBoxResize: vi.fn(), cancel: vi.fn(),
    };
    const executor = createDragUpdateExecutor({
      dispatchInteraction: vi.fn(), setSelectionPreview: vi.fn(), draw: vi.fn(),
      structuredPreviewQueue: queue, updateStructuredNode: vi.fn(),
      setStructuredTextSelection: vi.fn(), setTextCursor: vi.fn(),
      updateScratchForShape: vi.fn(), setHoveredGrid: vi.fn(),
    });
    expect(executor.queueStructuredMove).toBe(queue.queueMove);
    expect(executor.queueStructuredSplitBoxResize).toBe(queue.queueSplitBoxResize);
  });

  it("runs typed drawing state through the decision handler", () => {
    const executor = createExecutor();
    createDragUpdateHandler({ executor })({
      state: {
        type: "drawing", tool: "brush", start: { x: 0, y: 0 },
        lastGrid: { x: 0, y: 0 }, lastPlacedGrid: { x: 0, y: 0 },
      },
      tool: "brush", canvasMode: "freeform", currentGrid: { x: 2, y: 0 },
      canvasBounds: null, structuredScene: [],
    });
    expect(executor.draw).toHaveBeenCalledWith({ x: 2, y: 0 });
  });

  it("routes panning without resolving grid coordinates", () => {
    const queueOffsetDelta = vi.fn();
    const resolveCurrentGrid = vi.fn();
    createDragUpdateRouteHandler({
      panning: createPanningDragUpdateExecutor({ queueOffsetDelta }),
    })({
      state: { type: "panning", lastScreen: { x: 0, y: 0 } },
      delta: { x: 3, y: 4 }, resolveCurrentGrid, executePrimaryUpdate: vi.fn(),
    });
    expect(queueOffsetDelta).toHaveBeenCalledWith(3, 4);
    expect(resolveCurrentGrid).not.toHaveBeenCalled();
  });
});
