import { describe, expect, it, vi } from "vitest";
import {
  createPanningDragStartExecutor,
  createDragStartRouteHandler,
  createCanvasDragStartRouteAdapter,
  createPrimaryCanvasDragStartHandler,
  createDrawingShapeDragStartExecutor,
  createSelectionDragStartExecutor,
  executeDrawingShapeDragStartDecision,
  executePanningDragStart,
  executePrimaryCanvasDragStart,
  executeSelectionDragStartDecision,
  type DrawingShapeDragStartExecutor,
  type SelectionDragStartExecutor,
} from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/gestures/dragStartExecution";

const createSelectionExecutor = (): SelectionDragStartExecutor => ({
  dispatchInteraction: vi.fn(),
  clearInteractionState: vi.fn(),
  clearSelections: vi.fn(),
  setAnchorGrid: vi.fn(),
  setSelectionPreview: vi.fn(),
  setDragStartGrid: vi.fn(),
  clearTextCursor: vi.fn(),
});

const createDrawingExecutor = (): DrawingShapeDragStartExecutor => ({
  clearInteractionState: vi.fn(),
  clearEditingStructuredTextNode: vi.fn(),
  clearStructuredTextSelection: vi.fn(),
  setDragStartGrid: vi.fn(),
  setLastGrid: vi.fn(),
  setLastPlacedGrid: vi.fn(),
  setAnchorGrid: vi.fn(),
  clearLineAxis: vi.fn(),
  dispatchInteraction: vi.fn(),
  addScratchPoint: vi.fn(),
  erasePoint: vi.fn(),
});

describe("drag-start execution helpers", () => {
  it("executes panning drag starts", () => {
    const executor = {
      setIsPanning: vi.fn(),
      dispatchInteraction: vi.fn(),
      setBodyCursor: vi.fn(),
    };

    executePanningDragStart({ x: 10, y: 20 }, executor);

    expect(executor.setIsPanning).toHaveBeenCalledWith(true);
    expect(executor.dispatchInteraction).toHaveBeenCalledWith({
      type: "startPanning",
      lastScreen: { x: 10, y: 20 },
    });
    expect(executor.setBodyCursor).toHaveBeenCalledWith("grabbing");
  });

  it("creates panning drag-start executors that bind refs and callbacks", () => {
    const isPanning = { current: false };
    const dispatchInteraction = vi.fn();
    const setBodyCursor = vi.fn();
    const executor = createPanningDragStartExecutor({
      isPanning,
      dispatchInteraction,
      setBodyCursor,
    });

    executor.setIsPanning(true);
    executor.dispatchInteraction({ type: "reset" });
    executor.setBodyCursor("grabbing");

    expect(isPanning.current).toBe(true);
    expect(dispatchInteraction).toHaveBeenCalledWith({ type: "reset" });
    expect(setBodyCursor).toHaveBeenCalledWith("grabbing");
  });
  it("executes primary canvas structured select starts first", () => {
    const selection = createSelectionExecutor();
    const drawingShape = createDrawingExecutor();
    const executeStructuredSelectStart = vi.fn(() => true);

    expect(
      executePrimaryCanvasDragStart(
        {
          start: { x: 1, y: 2 },
          canvasMode: "structured",
          tool: "select",
          shiftKey: false,
          anchorGrid: null,
          canvasBounds: null,
          brushChar: "#",
          executeStructuredSelectStart,
        },
        { selection, drawingShape }
      )
    ).toBe(true);

    expect(executeStructuredSelectStart).toHaveBeenCalledTimes(1);
    expect(selection.dispatchInteraction).not.toHaveBeenCalled();
    expect(drawingShape.dispatchInteraction).not.toHaveBeenCalled();
  });

  it("falls back from primary canvas structured select to normal selection", () => {
    const selection = createSelectionExecutor();
    const drawingShape = createDrawingExecutor();

    expect(
      executePrimaryCanvasDragStart(
        {
          start: { x: 1, y: 2 },
          canvasMode: "structured",
          tool: "select",
          shiftKey: false,
          anchorGrid: null,
          canvasBounds: null,
          brushChar: "#",
          executeStructuredSelectStart: vi.fn(() => false),
        },
        { selection, drawingShape }
      )
    ).toBe(true);

    expect(selection.dispatchInteraction).toHaveBeenCalledWith({
      type: "startSelecting",
      anchor: { x: 1, y: 2 },
    });
    expect(drawingShape.dispatchInteraction).not.toHaveBeenCalled();
  });

  it("falls back from primary canvas selection to drawing and shape starts", () => {
    const selection = createSelectionExecutor();
    const drawingShape = createDrawingExecutor();

    expect(
      executePrimaryCanvasDragStart(
        {
          start: { x: 1, y: 2 },
          canvasMode: "freeform",
          tool: "brush",
          shiftKey: false,
          anchorGrid: null,
          canvasBounds: null,
          brushChar: "#",
          executeStructuredSelectStart: null,
        },
        { selection, drawingShape }
      )
    ).toBe(true);

    expect(selection.dispatchInteraction).not.toHaveBeenCalled();
    expect(drawingShape.dispatchInteraction).toHaveBeenCalledWith({
      type: "startDrawing",
      tool: "brush",
      lastGrid: { x: 1, y: 2 },
    });
    expect(drawingShape.addScratchPoint).toHaveBeenCalledWith({
      x: 1,
      y: 2,
      char: "#",
    });
  });
  it("ignores non-selection decisions", () => {
    const executor = createSelectionExecutor();

    expect(
      executeSelectionDragStartDecision({ type: "not-selection" }, executor)
    ).toBe(false);
    expect(executor.dispatchInteraction).not.toHaveBeenCalled();
  });

  it("executes selection starts and clears old selection when requested", () => {
    const executor = createSelectionExecutor();
    const preview = { start: { x: 1, y: 2 }, end: { x: 3, y: 4 } };

    expect(
      executeSelectionDragStartDecision(
        {
          type: "selection",
          interactionAnchor: { x: 3, y: 4 },
          dragStart: { x: 1, y: 2 },
          preview,
          clearExistingSelection: true,
          clearInteractionState: true,
          nextAnchor: { x: 3, y: 4 },
        },
        executor
      )
    ).toBe(true);

    expect(executor.dispatchInteraction).toHaveBeenCalledWith({
      type: "startSelecting",
      anchor: { x: 3, y: 4 },
    });
    expect(executor.clearInteractionState).toHaveBeenCalledTimes(1);
    expect(executor.clearSelections).toHaveBeenCalledTimes(1);
    expect(executor.setAnchorGrid).toHaveBeenCalledWith({ x: 3, y: 4 });
    expect(executor.setSelectionPreview).toHaveBeenCalledWith(preview);
    expect(executor.setDragStartGrid).toHaveBeenCalledWith({ x: 1, y: 2 });
    expect(executor.clearTextCursor).toHaveBeenCalledTimes(1);
  });

  it("creates selection executors that update hook refs", () => {
    const anchorGrid = { current: null };
    const dragStartGrid = { current: null };
    const setSelectionPreview = vi.fn();
    const clearTextCursor = vi.fn();
    const executor = createSelectionDragStartExecutor({
      anchorGrid,
      dragStartGrid,
      dispatchInteraction: vi.fn(),
      clearInteractionState: vi.fn(),
      clearSelections: vi.fn(),
      setSelectionPreview,
      clearTextCursor,
    });

    executor.setAnchorGrid({ x: 1, y: 2 });
    executor.setDragStartGrid({ x: 3, y: 4 });
    executor.setSelectionPreview({ start: { x: 1, y: 2 }, end: { x: 3, y: 4 } });
    executor.clearTextCursor();

    expect(anchorGrid.current).toEqual({ x: 1, y: 2 });
    expect(dragStartGrid.current).toEqual({ x: 3, y: 4 });
    expect(setSelectionPreview).toHaveBeenCalledWith({
      start: { x: 1, y: 2 },
      end: { x: 3, y: 4 },
    });
    expect(clearTextCursor).toHaveBeenCalledTimes(1);
  });

  it("ignores drawing/shape decisions marked ignore", () => {
    const executor = createDrawingExecutor();

    expect(
      executeDrawingShapeDragStartDecision(
        { type: "ignore" },
        { x: 1, y: 2 },
        executor
      )
    ).toBe(false);
    expect(executor.clearInteractionState).not.toHaveBeenCalled();
  });

  it("executes drawing starts and applies the first scratch point", () => {
    const executor = createDrawingExecutor();
    const start = { x: 1, y: 2 };

    expect(
      executeDrawingShapeDragStartDecision(
        {
          type: "drawing",
          event: { type: "startDrawing", tool: "brush", lastGrid: start },
          scratchPoint: { ...start, char: "#" },
        },
        start,
        executor
      )
    ).toBe(true);

    expect(executor.clearInteractionState).toHaveBeenCalledTimes(1);
    expect(executor.setDragStartGrid).toHaveBeenCalledWith(start);
    expect(executor.setLastGrid).toHaveBeenCalledWith(start);
    expect(executor.setLastPlacedGrid).toHaveBeenCalledWith(start);
    expect(executor.setAnchorGrid).toHaveBeenCalledWith(start);
    expect(executor.clearLineAxis).toHaveBeenCalledTimes(1);
    expect(executor.dispatchInteraction).toHaveBeenCalledWith({
      type: "startDrawing",
      tool: "brush",
      lastGrid: start,
    });
    expect(executor.addScratchPoint).toHaveBeenCalledWith({
      ...start,
      char: "#",
    });
  });

  it("executes shape preview starts without drawing points", () => {
    const executor = createDrawingExecutor();
    const start = { x: 1, y: 2 };

    expect(
      executeDrawingShapeDragStartDecision(
        {
          type: "shape-preview",
          event: { type: "startShapePreview", tool: "box", start },
        },
        start,
        executor
      )
    ).toBe(true);

    expect(executor.dispatchInteraction).toHaveBeenCalledWith({
      type: "startShapePreview",
      tool: "box",
      start,
    });
    expect(executor.addScratchPoint).not.toHaveBeenCalled();
    expect(executor.erasePoint).not.toHaveBeenCalled();
  });

  it("creates drawing/shape executors that update hook refs", () => {
    const dragStartGrid = { current: null };
    const lastGrid = { current: null };
    const lastPlacedGrid = { current: null };
    const anchorGrid = { current: null };
    const lineAxis = { current: "horizontal" as "vertical" | "horizontal" | null };
    const addScratchPoint = vi.fn();
    const erasePoint = vi.fn();
    const executor = createDrawingShapeDragStartExecutor({
      dragStartGrid,
      lastGrid,
      lastPlacedGrid,
      anchorGrid,
      lineAxis,
      dispatchInteraction: vi.fn(),
      clearInteractionState: vi.fn(),
      clearEditingStructuredTextNode: vi.fn(),
      clearStructuredTextSelection: vi.fn(),
      addScratchPoint,
      erasePoint,
    });

    executor.setDragStartGrid({ x: 1, y: 2 });
    executor.setLastGrid({ x: 3, y: 4 });
    executor.setLastPlacedGrid({ x: 5, y: 6 });
    executor.setAnchorGrid({ x: 7, y: 8 });
    executor.clearLineAxis();
    executor.addScratchPoint({ x: 1, y: 2, char: "#" });
    executor.erasePoint({ x: 3, y: 4 });

    expect(dragStartGrid.current).toEqual({ x: 1, y: 2 });
    expect(lastGrid.current).toEqual({ x: 3, y: 4 });
    expect(lastPlacedGrid.current).toEqual({ x: 5, y: 6 });
    expect(anchorGrid.current).toEqual({ x: 7, y: 8 });
    expect(lineAxis.current).toBeNull();
    expect(addScratchPoint).toHaveBeenCalledWith({ x: 1, y: 2, char: "#" });
    expect(erasePoint).toHaveBeenCalledWith({ x: 3, y: 4 });
  });

  it("creates drag-start route handlers that execute panning", () => {
    const panning = {
      setIsPanning: vi.fn(),
      dispatchInteraction: vi.fn(),
      setBodyCursor: vi.fn(),
    };
    const handler = createDragStartRouteHandler({ panning });
    const executeColorPickerStart = vi.fn(() => true);
    const executePrimaryCanvasStart = vi.fn(() => true);

    expect(
      handler({
        canvasMode: "freeform",
        tool: "pan",
        button: 0,
        isCtrlOrMetaPressed: false,
        hasColorPickerTarget: false,
        hasCanvasRect: true,
        screenPoint: { x: 10, y: 20 },
        executeColorPickerStart,
        executePrimaryCanvasStart,
      })
    ).toBe(true);

    expect(panning.dispatchInteraction).toHaveBeenCalledWith({
      type: "startPanning",
      lastScreen: { x: 10, y: 20 },
    });
    expect(executeColorPickerStart).not.toHaveBeenCalled();
    expect(executePrimaryCanvasStart).not.toHaveBeenCalled();
  });

  it("creates drag-start route handlers that dispatch color picker starts", () => {
    const panning = {
      setIsPanning: vi.fn(),
      dispatchInteraction: vi.fn(),
      setBodyCursor: vi.fn(),
    };
    const handler = createDragStartRouteHandler({ panning });
    const executeColorPickerStart = vi.fn(() => true);
    const executePrimaryCanvasStart = vi.fn(() => true);

    expect(
      handler({
        canvasMode: "freeform",
        tool: "select",
        button: 0,
        isCtrlOrMetaPressed: false,
        hasColorPickerTarget: true,
        hasCanvasRect: true,
        screenPoint: { x: 10, y: 20 },
        executeColorPickerStart,
        executePrimaryCanvasStart,
      })
    ).toBe(true);

    expect(executeColorPickerStart).toHaveBeenCalledTimes(1);
    expect(executePrimaryCanvasStart).not.toHaveBeenCalled();
    expect(panning.dispatchInteraction).not.toHaveBeenCalled();
  });

  it("creates drag-start route handlers that dispatch primary starts", () => {
    const panning = {
      setIsPanning: vi.fn(),
      dispatchInteraction: vi.fn(),
      setBodyCursor: vi.fn(),
    };
    const handler = createDragStartRouteHandler({ panning });
    const executeColorPickerStart = vi.fn(() => true);
    const executePrimaryCanvasStart = vi.fn(() => true);

    expect(
      handler({
        canvasMode: "structured",
        tool: "select",
        button: 0,
        isCtrlOrMetaPressed: false,
        hasColorPickerTarget: false,
        hasCanvasRect: true,
        screenPoint: { x: 10, y: 20 },
        executeColorPickerStart,
        executePrimaryCanvasStart,
      })
    ).toBe(true);

    expect(executePrimaryCanvasStart).toHaveBeenCalledTimes(1);
    expect(executeColorPickerStart).not.toHaveBeenCalled();
    expect(panning.dispatchInteraction).not.toHaveBeenCalled();
  });

  it("creates primary canvas drag-start handlers that bind executors", () => {
    const selection = createSelectionExecutor();
    const drawingShape = createDrawingExecutor();
    const executeStructuredSelectStart = vi.fn(() => true);
    const handler = createPrimaryCanvasDragStartHandler({
      selection,
      drawingShape,
    });

    expect(
      handler({
        start: { x: 1, y: 2 },
        canvasMode: "structured",
        tool: "select",
        shiftKey: false,
        anchorGrid: null,
        canvasBounds: null,
        brushChar: "#",
        executeStructuredSelectStart,
      })
    ).toBe(true);

    expect(executeStructuredSelectStart).toHaveBeenCalledTimes(1);
    expect(selection.dispatchInteraction).not.toHaveBeenCalled();
    expect(drawingShape.dispatchInteraction).not.toHaveBeenCalled();
  });

  it("creates primary canvas drag-start handlers that fall back to drawing", () => {
    const selection = createSelectionExecutor();
    const drawingShape = createDrawingExecutor();
    const handler = createPrimaryCanvasDragStartHandler({
      selection,
      drawingShape,
    });

    expect(
      handler({
        start: { x: 1, y: 2 },
        canvasMode: "freeform",
        tool: "brush",
        shiftKey: false,
        anchorGrid: null,
        canvasBounds: null,
        brushChar: "#",
        executeStructuredSelectStart: null,
      })
    ).toBe(true);

    expect(drawingShape.dispatchInteraction).toHaveBeenCalledWith({
      type: "startDrawing",
      tool: "brush",
      lastGrid: { x: 1, y: 2 },
    });
    expect(drawingShape.addScratchPoint).toHaveBeenCalledWith({
      x: 1,
      y: 2,
      char: "#",
    });
  });
  it("creates canvas drag-start adapters that resolve color-picker grid points", () => {
    const route = vi.fn(({ executeColorPickerStart }) => executeColorPickerStart());
    const colorPicker = vi.fn(() => true);
    const primaryCanvas = vi.fn(() => false);
    const structuredSelect = vi.fn(() => false);
    const resolveGridPoint = vi.fn(() => ({ x: 1, y: 2 }));
    const adapter = createCanvasDragStartRouteAdapter({
      route,
      colorPicker,
      primaryCanvas,
      structuredSelect,
    });
    const preventDefault = vi.fn();

    expect(
      adapter({
        canvasMode: "freeform",
        tool: "select",
        button: 0,
        isCtrlOrMetaPressed: false,
        hasColorPickerTarget: true,
        hasCanvasRect: true,
        screenPoint: { x: 10, y: 20 },
        shiftKey: false,
        anchorGrid: null,
        canvasBounds: null,
        brushChar: "#",
        mouseDetail: 1,
        preventDefault,
        resolveGridPoint,
        resolveLocalPoint: vi.fn(() => null),
      })
    ).toBe(true);

    expect(route).toHaveBeenCalledWith(
      expect.objectContaining({
        hasColorPickerTarget: true,
        screenPoint: { x: 10, y: 20 },
      })
    );
    expect(resolveGridPoint).toHaveBeenCalledWith({ x: 10, y: 20 });
    expect(colorPicker).toHaveBeenCalledWith({
      point: { x: 1, y: 2 },
      preventDefault,
    });
    expect(primaryCanvas).not.toHaveBeenCalled();
  });

  it("creates canvas drag-start adapters that skip primary starts without a grid point", () => {
    const route = vi.fn(({ executePrimaryCanvasStart }) =>
      executePrimaryCanvasStart()
    );
    const primaryCanvas = vi.fn(() => true);
    const adapter = createCanvasDragStartRouteAdapter({
      route,
      colorPicker: vi.fn(() => false),
      primaryCanvas,
      structuredSelect: vi.fn(() => false),
    });

    expect(
      adapter({
        canvasMode: "freeform",
        tool: "brush",
        button: 0,
        isCtrlOrMetaPressed: false,
        hasColorPickerTarget: false,
        hasCanvasRect: true,
        screenPoint: { x: 10, y: 20 },
        shiftKey: false,
        anchorGrid: null,
        canvasBounds: null,
        brushChar: "#",
        mouseDetail: 1,
        preventDefault: vi.fn(),
        resolveGridPoint: vi.fn(() => null),
        resolveLocalPoint: vi.fn(() => null),
      })
    ).toBe(false);

    expect(primaryCanvas).not.toHaveBeenCalled();
  });

  it("creates canvas drag-start adapters that bridge structured select starts", () => {
    const route = vi.fn(({ executePrimaryCanvasStart }) =>
      executePrimaryCanvasStart()
    );
    const structuredSelect = vi.fn(() => true);
    const primaryCanvas = vi.fn((context) =>
      context.executeStructuredSelectStart?.()
    );
    const adapter = createCanvasDragStartRouteAdapter({
      route,
      colorPicker: vi.fn(() => false),
      primaryCanvas,
      structuredSelect,
    });

    expect(
      adapter({
        canvasMode: "structured",
        tool: "select",
        button: 0,
        isCtrlOrMetaPressed: false,
        hasColorPickerTarget: false,
        hasCanvasRect: true,
        screenPoint: { x: 10, y: 20 },
        shiftKey: true,
        anchorGrid: { x: 5, y: 6 },
        canvasBounds: { width: 80, height: 40 },
        brushChar: "#",
        mouseDetail: 2,
        preventDefault: vi.fn(),
        resolveGridPoint: vi.fn(() => ({ x: 1, y: 2 })),
        resolveLocalPoint: vi.fn(() => ({ x: 11, y: 12 })),
      })
    ).toBe(true);

    expect(primaryCanvas).toHaveBeenCalledWith(
      expect.objectContaining({
        start: { x: 1, y: 2 },
        canvasMode: "structured",
        tool: "select",
        shiftKey: true,
        anchorGrid: { x: 5, y: 6 },
        canvasBounds: { width: 80, height: 40 },
        brushChar: "#",
      })
    );
    expect(structuredSelect).toHaveBeenCalledWith({
      screenPoint: { x: 11, y: 12 },
      start: { x: 1, y: 2 },
      mouseDetail: 2,
    });
  });
});
