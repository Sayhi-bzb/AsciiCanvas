import { describe, expect, it, vi } from "vitest";
import {
  createCanvasDragStartRouteAdapter,
  createDragStartRouteHandler,
  createDrawingShapeDragStartExecutor,
  createPanningDragStartExecutor,
  createPrimaryCanvasDragStartHandler,
  createSelectionDragStartExecutor,
  executeDrawingShapeDragStartDecision,
  executePanningDragStart,
  executeSelectionDragStartDecision,
} from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/gestures/dragStartExecution";

describe("canvas drag-start execution", () => {
  it("starts panning through typed interaction state", () => {
    const dispatchInteraction = vi.fn();
    const setBodyCursor = vi.fn();
    executePanningDragStart(
      { x: 12, y: 24 },
      createPanningDragStartExecutor({ dispatchInteraction, setBodyCursor })
    );
    expect(dispatchInteraction).toHaveBeenCalledWith({
      type: "startPanning",
      lastScreen: { x: 12, y: 24 },
    });
    expect(setBodyCursor).toHaveBeenCalledWith("grabbing");
  });

  it("starts selection with the effective shift anchor", () => {
    const dispatchInteraction = vi.fn();
    const setAnchorGrid = vi.fn();
    const setSelectionPreview = vi.fn();
    const executor = createSelectionDragStartExecutor({
      setAnchorGrid,
      dispatchInteraction,
      clearInteractionState: vi.fn(),
      clearSelections: vi.fn(),
      setSelectionPreview,
      clearTextCursor: vi.fn(),
    });

    expect(executeSelectionDragStartDecision({
      type: "selection",
      interactionAnchor: { x: 5, y: 6 },
      dragStart: { x: 1, y: 2 },
      preview: { start: { x: 1, y: 2 }, end: { x: 5, y: 6 } },
      clearExistingSelection: false,
      clearInteractionState: true,
      nextAnchor: null,
    }, executor)).toBe(true);

    expect(dispatchInteraction).toHaveBeenCalledWith({
      type: "startSelecting",
      anchor: { x: 1, y: 2 },
      current: { x: 5, y: 6 },
    });
    expect(setAnchorGrid).not.toHaveBeenCalled();
    expect(setSelectionPreview).toHaveBeenCalled();
  });

  it("starts drawing and applies the initial scratch point", () => {
    const dispatchInteraction = vi.fn();
    const addScratchPoint = vi.fn();
    const executor = createDrawingShapeDragStartExecutor({
      setAnchorGrid: vi.fn(),
      dispatchInteraction,
      clearInteractionState: vi.fn(),
      clearEditingStructuredTextNode: vi.fn(),
      clearStructuredTextSelection: vi.fn(),
      addScratchPoint,
      erasePoint: vi.fn(),
    });
    const start = { x: 3, y: 4 };

    expect(executeDrawingShapeDragStartDecision({
      type: "drawing",
      event: { type: "startDrawing", tool: "brush", start },
      scratchPoint: { ...start, char: "#" },
    }, start, executor)).toBe(true);
    expect(dispatchInteraction).toHaveBeenCalledWith({
      type: "startDrawing", tool: "brush", start,
    });
    expect(addScratchPoint).toHaveBeenCalledWith({ ...start, char: "#" });
  });

  it("routes normalized primary-canvas input through the adapter", () => {
    const dispatchInteraction = vi.fn();
    const route = createDragStartRouteHandler({
      panning: createPanningDragStartExecutor({
        dispatchInteraction,
        setBodyCursor: vi.fn(),
      }),
    });
    const primaryCanvas = createPrimaryCanvasDragStartHandler({
      selection: createSelectionDragStartExecutor({
        setAnchorGrid: vi.fn(), dispatchInteraction,
        clearInteractionState: vi.fn(), clearSelections: vi.fn(),
        setSelectionPreview: vi.fn(), clearTextCursor: vi.fn(),
      }),
      drawingShape: createDrawingShapeDragStartExecutor({
        setAnchorGrid: vi.fn(), dispatchInteraction,
        clearInteractionState: vi.fn(), clearEditingStructuredTextNode: vi.fn(),
        clearStructuredTextSelection: vi.fn(), addScratchPoint: vi.fn(), erasePoint: vi.fn(),
      }),
    });
    const adapter = createCanvasDragStartRouteAdapter({
      route,
      colorPicker: vi.fn(() => false),
      primaryCanvas,
      structuredSelect: vi.fn(() => false),
    });

    expect(adapter({
      canvasMode: "freeform", tool: "brush", button: 0,
      isCtrlOrMetaPressed: false, hasColorPickerTarget: false, hasCanvasRect: true,
      screenPoint: { x: 100, y: 120 }, shiftKey: false, anchorGrid: null,
      canvasBounds: null, brushChar: "#", mouseDetail: 1,
      preventDefault: vi.fn(),
      resolveGridPoint: () => ({ x: 2, y: 3 }),
      resolveLocalPoint: () => ({ x: 100, y: 120 }),
    })).toBe(true);
    expect(dispatchInteraction).toHaveBeenCalledWith({
      type: "startDrawing", tool: "brush", start: { x: 2, y: 3 },
    });
  });
});
