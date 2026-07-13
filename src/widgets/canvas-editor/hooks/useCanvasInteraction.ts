import { useEffect, useRef, useState } from "react";
import { useCreation, useThrottleFn } from "ahooks";
import { GridManager } from "@/shared/utils/grid";
import type { SelectionArea } from "@/shared/types";
import type { CanvasState } from "@/domains/canvas/public";
import { forceHistorySave } from "@/shared/lib/yjs-setup";
import { browser } from "@/shared/services/browser";
import { MIN_ZOOM, MAX_ZOOM } from "@/shared/lib/constants";
import { type CanvasLinkHit } from "./interaction/core/linkHitTesting";
import { type StructuredMovePreview } from "./interaction/structured/structuredInteractionPreview";

import {
  createViewportInteractionController,
} from "./interaction/viewport/viewportInteractionController";
import {
  createSelectionPreviewController,
} from "./interaction/preview/selectionPreviewController";

import {
  createCanvasClickExecutor,
  createCanvasClickHandler,
  createCanvasClickRouteHandler,
} from "./interaction/gestures/clickExecution";
import {
  createColorPickerDragStartExecutor,
  createColorPickerDragStartHandler,
} from "./interaction/gestures/colorPickerInteraction";
import {
  createCanvasMoveExecutor,
  createCanvasMoveHandler,
  createCanvasMoveRouteHandler,
} from "./interaction/gestures/moveExecution";
import {
  createCanvasPinchExecutor,
  createCanvasPinchHandler,
  createCanvasPinchRouteHandler,
} from "./interaction/gestures/pinchInteraction";
import {
  createCanvasWheelExecutor,
  createCanvasWheelHandler,
  createCanvasWheelRouteHandler,
} from "./interaction/gestures/wheelInteraction";
import {
  createNonPanningDragEndExecutor,
  createPanningDragEndExecutor,
  createPrimaryDragEndExecutor,
  createPrimaryDragEndHandler,
  createDragEndRouteHandler,
} from "./interaction/gestures/dragEndExecution";
import {
  createPanningDragUpdateExecutor,
  createDragUpdateExecutor,
  createDragUpdateHandler,
  createDragUpdateRouteHandler,
} from "./interaction/gestures/dragUpdateExecution";
import { createDragResetController } from "./interaction/gestures/dragResetExecution";
import {
  createStructuredPreviewQueueController,
} from "./interaction/structured/structuredPreviewQueueExecution";
import { createDrawingUpdateHandler } from "./interaction/gestures/drawingInteraction";
import {
  createPanningDragStartExecutor,
  createDragStartRouteHandler,
  createCanvasDragStartRouteAdapter,
  createPrimaryCanvasDragStartHandler,
  createDrawingShapeDragStartExecutor,
  createSelectionDragStartExecutor,
} from "./interaction/gestures/dragStartExecution";
import {
  createStructuredSelectStartHandler,
  createStructuredSelectStartExecutor,
} from "./interaction/structured/structuredSelectExecution";
import {
  createStructuredEditController,
  createStructuredEditRouteHandler,
} from "./interaction/structured/structuredEditExecution";
import {
  createHoverInteractionController,
} from "./interaction/preview/hoverInteractionController";
import {
  shouldIgnoreActiveCanvasGesture,
  shouldIgnoreCanvasSurfaceGesture,
} from "./interaction/core/gestureGuards";
import { createCanvasPointerContextResolver } from "./interaction/core/pointerContext";
export { shouldOpenCanvasLink, shouldUseCanvasLinkPointer } from "./interaction/core/hitTesting";
import { useCanvasGestureAdapter } from "./interaction/gestures/gestureAdapter";
import {
  type InteractionEvent,
} from "./interaction/core/interactionMachine";
import { createCanvasInteractionRuntime } from "./interaction/core/interactionRuntime";



export const useCanvasInteraction = (
  store: Pick<
    CanvasState,
    | "tool"
    | "brushChar"
    | "brushColor"
    | "setBrushColor"
    | "canvasColorPickerTarget"
    | "setCanvasColorPickerTarget"
    | "setOffset"
    | "setZoom"
    | "canvasMode"
    | "addScratchPoints"
    | "commitScratch"
    | "commitStructuredShape"
    | "setTextCursor"
    | "addSelection"
    | "clearSelections"
    | "clearInteractionState"
    | "erasePoints"
    | "offset"
    | "zoom"
    | "grid"
    | "updateScratchForShape"
    | "setHoveredGrid"
    | "fillArea"
    | "canvasBounds"
    | "structuredScene"
    | "editingStructuredTextNodeId"
    | "selectedStructuredNodeIds"
    | "setStructuredGridFocus"
    | "setStructuredContextPoint"
    | "setSelectedStructuredNodeIds"
    | "setSelectedStructuredSplitHandle"
    | "setEditingStructuredTextNodeId"
    | "setStructuredTextSelection"
    | "structuredTextSelection"
    | "setStructuredTextColor"
    | "applyStructuredScene"
    | "updateStructuredNode"
  >,
  containerRef: React.RefObject<HTMLDivElement | null>,
  setHoveredLink: (hit: CanvasLinkHit | null) => void,
  structuredMovePreviewRef?: React.MutableRefObject<StructuredMovePreview | null>,
  requestRenderRef?: React.MutableRefObject<(() => void) | null>
) => {
  const {
    tool,
    brushChar,
    setBrushColor,
    canvasColorPickerTarget,
    setCanvasColorPickerTarget,
    setOffset,
    setZoom,
    canvasMode,
    addScratchPoints,
    commitScratch,
    commitStructuredShape,
    setTextCursor,
    addSelection,
    clearSelections,
    clearInteractionState,
    erasePoints,
    offset,
    zoom,
    grid,
    updateScratchForShape,
    setHoveredGrid,
    fillArea,
    canvasBounds,
    structuredScene,
    editingStructuredTextNodeId,
    selectedStructuredNodeIds,
    setStructuredGridFocus,
    setStructuredContextPoint,
    setSelectedStructuredNodeIds,
    setSelectedStructuredSplitHandle,
    setEditingStructuredTextNodeId,
    setStructuredTextSelection,
    structuredTextSelection,
    setStructuredTextColor,
    applyStructuredScene,
    updateStructuredNode,
  } = store;

  const pointerContext = useCreation(
    () =>
      createCanvasPointerContextResolver({
        getRect: () => containerRef.current?.getBoundingClientRect(),
        getViewport: () => ({ offset, zoom }),
        getGrid: () => grid,
        getCanvasMode: () => canvasMode,
        getCanvasBounds: () => canvasBounds,
      }),
    [containerRef, offset, zoom, grid, canvasMode, canvasBounds]
  );
  const canvasModeRef = useRef(canvasMode);
  useEffect(() => {
    canvasModeRef.current = canvasMode;
  }, [canvasMode]);
  const interactionRuntime = useCreation(createCanvasInteractionRuntime, []);
  const colorPickerClickRef = useRef(false);
  const fallbackStructuredMovePreviewRef =
    useRef<StructuredMovePreview | null>(null);
  const fallbackRequestRenderRef = useRef<(() => void) | null>(null);
  const activeStructuredMovePreviewRef =
    structuredMovePreviewRef ?? fallbackStructuredMovePreviewRef;
  const activeRequestRenderRef = requestRenderRef ?? fallbackRequestRenderRef;
  const [draggingSelection, setDraggingSelectionState] =
    useState<SelectionArea | null>(null);

  const hoverInteraction = useCreation(
    () =>
      createHoverInteractionController({
        getContainer: () => containerRef.current,
        setHoveredLink,
        setHoveredGrid,
      }),
    [containerRef, setHoveredLink, setHoveredGrid]
  );
  const selectionPreview = useCreation(
    () =>
      createSelectionPreviewController({
        setPreview: setDraggingSelectionState,
      }),
    []
  );
  const viewportInteraction = useCreation(
    () =>
      createViewportInteractionController({
        setOffset,
        setZoom,
        getCanvasMode: () => canvasModeRef.current,
        zoomBounds: { min: MIN_ZOOM, max: MAX_ZOOM },
      }),
    [setOffset, setZoom]
  );

  const dispatchInteraction = (event: InteractionEvent) => {
    interactionRuntime.dispatch(event);
  };

  const getInteractionState = () => interactionRuntime.getState();

  const clearStructuredMovePreview = () => {
    if (!activeStructuredMovePreviewRef.current) return;
    activeStructuredMovePreviewRef.current = null;
    activeRequestRenderRef.current?.();
  };

  const setStructuredMovePreview = (preview: StructuredMovePreview) => {
    activeStructuredMovePreviewRef.current = preview;
    activeRequestRenderRef.current?.();
  };



  const shouldIgnoreActiveGestureEvent = (event: Event | undefined) =>
    shouldIgnoreActiveCanvasGesture({
      event,
      interactionMode: getInteractionState().type,
      hasDragStartGrid: getInteractionState().type !== "idle",
      isPanning: getInteractionState().type === "panning",
    });

  const structuredPreviewQueue = useCreation(
    () =>
      createStructuredPreviewQueueController({
        setStructuredMovePreview,
        applyStructuredScene,
        clearStructuredMovePreview,
      }),
    [activeRequestRenderRef, activeStructuredMovePreviewRef, applyStructuredScene]
  );
  const resetDragState = useCreation(
    () =>
      createDragResetController({
        structuredPreviewQueue,
        clearStructuredMovePreview,
        dispatchInteraction,
      }).reset,
    [structuredPreviewQueue]
  );
  useEffect(() => {
    const syncModifierState = (event: KeyboardEvent) => {
      hoverInteraction.syncLinkModifierState(event);
    };
    window.addEventListener("keydown", syncModifierState);
    window.addEventListener("keyup", syncModifierState);
    return () => {
      window.removeEventListener("keydown", syncModifierState);
      window.removeEventListener("keyup", syncModifierState);
    };
  }, [hoverInteraction]);

  useEffect(
    () => () => {
      viewportInteraction.cancel();
      structuredPreviewQueue.cancel();
      selectionPreview.cancel();
      browser.setBodyCursor("");
    },
    [selectionPreview, structuredPreviewQueue, viewportInteraction]
  );
  const handleDrawing = useCreation(
    () =>
      createDrawingUpdateHandler({
        getBrushChar: () => brushChar,
        getInteractionState,
        executor: {
          addScratchPoints,
          erasePoints: (points) => erasePoints(points, false),
          dispatchInteraction,
        },
      }),
    [tool, brushChar, addScratchPoints, erasePoints]
  );
  const { run: throttledDraw } = useThrottleFn(handleDrawing, {
    wait: 8,
    trailing: true,
  });
  const structuredEditController = createStructuredEditController({
    getCanvasMode: () => canvasMode,
    getTool: () => tool,
    resolvePoint: (clientX, clientY) =>
      pointerContext.resolveGridPoint(clientX, clientY),
    getStructuredScene: () => structuredScene,
    getSelectedStructuredNodeIds: () => selectedStructuredNodeIds,
    getEditingStructuredTextNodeId: () => editingStructuredTextNodeId,
    executor: {
      setSelectedStructuredNodeIds,
      setSelectedStructuredSplitHandle,
      clearSelections,
      setTextCursor,
      setEditingStructuredTextNodeId,
      setStructuredTextSelection,
      setSelectionPreview: (selection) => selectionPreview.set(selection),
      resetDragState,
      setCursor: (cursor) => hoverInteraction.setCursor(cursor),
    },
  });
  const structuredEditRouteHandler = createStructuredEditRouteHandler({
    controller: structuredEditController,
  });
  const panningDragStartExecutor = createPanningDragStartExecutor({
    dispatchInteraction,
    setBodyCursor: (cursor) => {
      browser.setBodyCursor(cursor);
    },
  });
  const dragStartRouteHandler = createDragStartRouteHandler({
    panning: panningDragStartExecutor,
  });
  const selectionDragStartExecutor = createSelectionDragStartExecutor({
    setAnchorGrid: interactionRuntime.setSelectionAnchor,
    dispatchInteraction,
    clearInteractionState,
    clearSelections,
    setSelectionPreview: (selection) => selectionPreview.set(selection),
    clearTextCursor: () => setTextCursor(null),
  });
  const drawingShapeDragStartExecutor = createDrawingShapeDragStartExecutor({
    setAnchorGrid: interactionRuntime.setSelectionAnchor,
    dispatchInteraction,
    clearInteractionState,
    clearEditingStructuredTextNode: () => setEditingStructuredTextNodeId(null),
    clearStructuredTextSelection: () => setStructuredTextSelection(null),
    addScratchPoint: (point) => addScratchPoints([point]),
    erasePoint: (point) => erasePoints([point], false),
  });
  const primaryCanvasDragStartHandler = createPrimaryCanvasDragStartHandler({
    selection: selectionDragStartExecutor,
    drawingShape: drawingShapeDragStartExecutor,
  });
  const structuredSelectStartExecutor = createStructuredSelectStartExecutor({
    setSelectedStructuredNodeIds,
    setSelectedStructuredSplitHandle,
    setStructuredContextPoint,
    setEditingStructuredTextNodeId,
    setStructuredTextSelection,
    setTextCursor,
    clearSelections,
    setSelectionPreview: (selection) => selectionPreview.set(selection),
    resetDragState,
    setCursor: (cursor) => hoverInteraction.setCursor(cursor),
    dispatchInteraction,
  });
  const panningDragUpdateExecutor = createPanningDragUpdateExecutor({
    queueOffsetDelta: (dx, dy) => viewportInteraction.queueOffsetDelta(dx, dy),
  });
  const structuredSelectStartHandler = createStructuredSelectStartHandler({
    selectedStructuredNodeIds,
    structuredScene,
    offset,
    zoom,
    editingStructuredTextNodeId,
    executor: structuredSelectStartExecutor,
  });
  const dragUpdateExecutor = createDragUpdateExecutor({
    dispatchInteraction,
    setSelectionPreview: (selection) => selectionPreview.set(selection),
    draw: (point) => throttledDraw(point),
    structuredPreviewQueue,
    updateStructuredNode,
    setStructuredTextSelection,
    setTextCursor,
    updateScratchForShape,
    setHoveredGrid,
  });
  const dragUpdateHandler = createDragUpdateHandler({
    executor: dragUpdateExecutor,
  });
  const dragUpdateRouteHandler = createDragUpdateRouteHandler({
    panning: panningDragUpdateExecutor,
  });
  const nonPanningDragEndExecutor = createNonPanningDragEndExecutor({
    setBodyCursor: (cursor) => {
      browser.setBodyCursor(cursor);
    },
  });
  const panningDragEndExecutor = createPanningDragEndExecutor({
    flushOffset: () => viewportInteraction.flushOffset(),
    dispatchInteraction,
    setBodyCursor: (cursor) => {
      browser.setBodyCursor(cursor);
    },
    clearLinkHover: () => hoverInteraction.clearLinkHover(),
  });
  const primaryDragEndExecutor = createPrimaryDragEndExecutor({
    selectionPreview,
    structuredPreviewQueue,
    fillArea,
    setSelectedStructuredNodeIds,
    setSelectedStructuredSplitHandle,
    setStructuredGridFocus,
    setTextCursor,
    addSelection,
    clearSelections,
    commitScratch,
    forceHistorySave,
    commitStructuredShape,
    resetDragState,
  });
  const primaryDragEndHandler = createPrimaryDragEndHandler({
    executor: primaryDragEndExecutor,
  });
  const dragEndRouteHandler = createDragEndRouteHandler({
    panning: panningDragEndExecutor,
    nonPanning: nonPanningDragEndExecutor,
  });
  const canvasPinchExecutor = createCanvasPinchExecutor({
    setZoom,
    setOffset,
  });
  const canvasPinchHandler = createCanvasPinchHandler({
    executor: canvasPinchExecutor,
  });
  const canvasPinchRouteHandler = createCanvasPinchRouteHandler({
    handler: canvasPinchHandler,
  });
  const colorPickerDragStartExecutor = useCreation(
    () =>
      createColorPickerDragStartExecutor({
        colorPickerClick: colorPickerClickRef,
        preventDefault: () => undefined,
        setBrushColor,
        setStructuredTextColor,
        clearColorPickerTarget: () => setCanvasColorPickerTarget(null),
        clearHoveredGrid: () => setHoveredGrid(null),
        resetDragState,
        setCursor: (cursor) => hoverInteraction.setCursor(cursor),
      }),
    [
      hoverInteraction,
      resetDragState,
      setBrushColor,
      setCanvasColorPickerTarget,
      setHoveredGrid,
      setStructuredTextColor,
    ]
  );
  const colorPickerDragStartHandler = createColorPickerDragStartHandler({
    target: canvasColorPickerTarget,
    isStructuredTextSelectionActive:
      canvasMode === "structured" && !!structuredTextSelection,
    getCell: (point) => grid.get(GridManager.toKey(point.x, point.y)),
    executor: colorPickerDragStartExecutor,
  });
  const canvasDragStartRouteAdapter = createCanvasDragStartRouteAdapter({
    route: dragStartRouteHandler,
    colorPicker: colorPickerDragStartHandler,
    primaryCanvas: primaryCanvasDragStartHandler,
    structuredSelect: structuredSelectStartHandler,
  });
  const canvasClickExecutor = useCreation(
    () =>
      createCanvasClickExecutor({
        colorPickerClick: colorPickerClickRef,
        preventDefault: () => undefined,
        clearSelections,
        setSelectedStructuredNodeIds,
        setSelectedStructuredSplitHandle,
        setEditingStructuredTextNodeId,
        setTextCursor,
        setCursor: (cursor) => hoverInteraction.setCursor(cursor),
        openLink: (href) => window.open(href, "_blank", "noopener,noreferrer"),
        setHoveredLink,
      }),
    [
      clearSelections,
      hoverInteraction,
      setEditingStructuredTextNodeId,
      setHoveredLink,
      setSelectedStructuredNodeIds,
      setSelectedStructuredSplitHandle,
      setTextCursor,
    ]
  );
  const canvasClickHandler = useCreation(
    () =>
      createCanvasClickHandler({
        getColorPickerClickPending: () => colorPickerClickRef.current,
        getInteractionMode: () => getInteractionState().type,
        canvasMode,
        tool,
        executor: canvasClickExecutor,
      }),
    [canvasClickExecutor, canvasMode, tool]
  );
  const canvasClickRouteHandler = createCanvasClickRouteHandler({
    handler: canvasClickHandler,
  });
  const canvasMoveExecutor = createCanvasMoveExecutor({
    updateColorPickerHover: (hoverPoint) =>
      hoverInteraction.updateColorPickerHover(hoverPoint),
    updateLinkHover: (hit, hoverEvent) =>
      hoverInteraction.updateLinkHover(hit, hoverEvent),
    setHoveredGrid,
    setCursor: (cursor) => hoverInteraction.setCursor(cursor),
  });
  const canvasMoveHandler = createCanvasMoveHandler({
    executor: canvasMoveExecutor,
  });
  const canvasMoveRouteHandler = createCanvasMoveRouteHandler({
    handler: canvasMoveHandler,
  });
  const canvasWheelExecutor = createCanvasWheelExecutor({
    preventDefault: () => undefined,
    flushOffset: () => viewportInteraction.flushOffset(),
    queueZoomDelta: (deltaZoom, mouseX, mouseY) =>
      viewportInteraction.queueZoomDelta(deltaZoom, mouseX, mouseY),
    queueOffsetDelta: (dx, dy) => viewportInteraction.queueOffsetDelta(dx, dy),
  });
  const canvasWheelHandler = createCanvasWheelHandler({
    canvasMode,
    executor: canvasWheelExecutor,
  });
  const canvasWheelRouteHandler = createCanvasWheelRouteHandler({
    handler: canvasWheelHandler,
  });
  const bind = useCanvasGestureAdapter({
    containerRef,
    canvasMode,
    tool,
    brushChar,
    canvasBounds,
    zoom,
    hasColorPickerTarget: !!canvasColorPickerTarget,
    selectedStructuredNodeIds,
    structuredScene,
    editingStructuredTextNodeId,
    pointerContext,
    interactionRuntime,
    hoverInteraction,
    shouldIgnoreActiveGestureEvent,
    canvasPinchRouteHandler,
    canvasMoveRouteHandler,
    canvasDragStartRouteAdapter,
    dragUpdateRouteHandler,
    dragUpdateHandler,
    dragEndRouteHandler,
    primaryDragEndHandler,
    canvasClickRouteHandler,
    canvasWheelRouteHandler,
  });

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    structuredEditRouteHandler({
      clientPoint: { x: event.clientX, y: event.clientY },
      shouldIgnore: () => shouldIgnoreCanvasSurfaceGesture(event.nativeEvent),
      preventDefault: () => event.preventDefault(),
    });
  };

  return { bind, draggingSelection, handleDoubleClick };
};
