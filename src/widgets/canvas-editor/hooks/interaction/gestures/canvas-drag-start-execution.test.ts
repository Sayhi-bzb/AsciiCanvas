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
} from "@/widgets/canvas-editor/hooks/interaction/gestures/dragStartExecution";

describe("canvas drag-start execution", () => {
  it("starts panning through typed interaction state", () => {
    const setInteractionState = vi.fn();
    const setCursor = vi.fn();
    executePanningDragStart(
      { x: 12, y: 24 },
      createPanningDragStartExecutor({ setInteractionState, setCursor })
    );
    expect(setInteractionState).toHaveBeenCalledWith({
      type: "panning", lastScreen: { x: 12, y: 24 },
    });
    expect(setCursor).toHaveBeenCalledWith("grabbing");
  });

  it("starts selection with the effective shift anchor", () => {
    const setInteractionState = vi.fn();
    const setAnchorGrid = vi.fn();
    const setSelectionPreview = vi.fn();
    const executor = createSelectionDragStartExecutor({
      setAnchorGrid,
      setInteractionState,
      clearInteractionState: vi.fn(),
      clearSelections: vi.fn(),
      setStaticGridSelectionStart: vi.fn(),
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
      activateStaticGridCell: null,
      nextAnchor: null,
    }, executor)).toBe(true);

    expect(setInteractionState).toHaveBeenCalledWith({
      type: "selecting",
      anchor: { x: 1, y: 2 },
      current: { x: 5, y: 6 },
    });
    expect(setAnchorGrid).not.toHaveBeenCalled();
    expect(setSelectionPreview).toHaveBeenCalled();
  });

  it("activates the pointer origin when ordinary grid selection starts", () => {
    const setStaticGridSelectionStart = vi.fn();
    const executor = createSelectionDragStartExecutor({
      setAnchorGrid: vi.fn(),
      setInteractionState: vi.fn(),
      clearInteractionState: vi.fn(),
      clearSelections: vi.fn(),
      setStaticGridSelectionStart,
      setSelectionPreview: vi.fn(),
      clearTextCursor: vi.fn(),
    });
    const start = { x: 4, y: 6 };

    executeSelectionDragStartDecision({
      type: "selection",
      interactionAnchor: start,
      dragStart: start,
      preview: { start, end: start },
      clearExistingSelection: true,
      clearInteractionState: false,
      activateStaticGridCell: start,
      nextAnchor: start,
    }, executor);

    expect(setStaticGridSelectionStart).toHaveBeenCalledWith(start);
  });

  it("starts drawing and applies the initial scratch point", () => {
    const setInteractionState = vi.fn();
    const addScratchPoint = vi.fn();
    const executor = createDrawingShapeDragStartExecutor({
      setAnchorGrid: vi.fn(),
      setInteractionState,
      clearInteractionState: vi.fn(),
      clearEditingStructuredTextNode: vi.fn(),
      clearStructuredTextSelection: vi.fn(),
      addScratchPoint,
      erasePoint: vi.fn(),
    });
    const start = { x: 3, y: 4 };

    expect(executeDrawingShapeDragStartDecision({
      type: "drawing",
      state: { type: "drawing", tool: "brush", start, lastGrid: start, lastPlacedGrid: start },
      scratchPoint: { ...start, char: "#" },
    }, start, executor)).toBe(true);
    expect(setInteractionState).toHaveBeenCalledWith({
      type: "drawing", tool: "brush", start, lastGrid: start, lastPlacedGrid: start,
    });
    expect(addScratchPoint).toHaveBeenCalledWith({ ...start, char: "#" });
  });

  it("routes normalized primary-canvas input through the adapter", () => {
    const setInteractionState = vi.fn();
    const route = createDragStartRouteHandler({
      panning: createPanningDragStartExecutor({
        setInteractionState,
        setCursor: vi.fn(),
      }),
    });
    const primaryCanvas = createPrimaryCanvasDragStartHandler({
      selection: createSelectionDragStartExecutor({
        setAnchorGrid: vi.fn(), setInteractionState,
        clearInteractionState: vi.fn(), clearSelections: vi.fn(),
        setStaticGridSelectionStart: vi.fn(),
        setSelectionPreview: vi.fn(), clearTextCursor: vi.fn(),
      }),
      drawingShape: createDrawingShapeDragStartExecutor({
        setAnchorGrid: vi.fn(), setInteractionState,
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
      screenPoint: { x: 100, y: 120 }, shiftKey: false, anchorGrid: null, brushChar: "#", mouseDetail: 1,
      preventDefault: vi.fn(),
      resolveGridPoint: () => ({ x: 2, y: 3 }),
      resolveLocalPoint: () => ({ x: 100, y: 120 }),
    })).toBe(true);
    expect(setInteractionState).toHaveBeenCalledWith({
      type: "drawing", tool: "brush", start: { x: 2, y: 3 },
      lastGrid: { x: 2, y: 3 }, lastPlacedGrid: { x: 2, y: 3 },
    });
  });
});
