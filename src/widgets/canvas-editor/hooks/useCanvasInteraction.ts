import { useCreation, useThrottleFn } from "ahooks";
import { GridManager } from "@/shared/utils/grid";
import { canvasCommands } from "@/domains/canvas/public";
import { type CanvasLinkHit } from "./interaction/core/linkHitTesting";
import { type StructuredMovePreview } from "./interaction/structured/structuredInteractionPreview";

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
  shouldIgnoreActiveCanvasGesture,
  shouldIgnoreCanvasSurfaceGesture,
} from "./interaction/core/gestureGuards";
export { shouldOpenCanvasLink, shouldUseCanvasLinkPointer } from "./interaction/core/hitTesting";
import { useCanvasGestureAdapter } from "./interaction/gestures/gestureAdapter";
import { useInteractionControllers } from "./interaction/use-interaction-controllers";
import type { CanvasEngineRuntime } from "../engine/CanvasEngineRuntime";
import type { useCanvasEditorModels } from "./useCanvasEditorModels";



export const useCanvasInteraction = (
  store: ReturnType<typeof useCanvasEditorModels>["interaction"],
  containerRef: React.RefObject<HTMLDivElement | null>,
  setHoveredLink: (hit: CanvasLinkHit | null) => void,
  structuredMovePreviewRef?: React.MutableRefObject<StructuredMovePreview | null>,
  requestRenderRef?: React.MutableRefObject<(() => void) | null>,
  runtime?: CanvasEngineRuntime
) => {
  const {
    tool,
    brushChar,
    setBrushColor,
    canvasColorPickerTarget,
    setCanvasColorPickerTarget,
    setViewport,
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
    updateStructuredNode,
  } = store;

  const {
    beginInteraction,
    cancelInteraction,
    colorPickerClickRef,
    completeInteraction,
    dispatchInteraction,
    draggingSelection,
    edgeScroll,
    getInteractionState,
    hoverInteraction,
    interactionRuntime,
    pointerContext,
    resetDragState,
    selectionPreview,
    structuredPreviewQueue,
    viewportInteraction,
  } = useInteractionControllers({
    store,
    containerRef,
    setHoveredLink,
    structuredMovePreviewRef,
    requestRenderRef,
    runtime,
  });
  const shouldIgnoreActiveGestureEvent = (event: Event | undefined) =>
    shouldIgnoreActiveCanvasGesture({
      event,
      interactionMode: getInteractionState().type,
      hasDragStartGrid: getInteractionState().type !== "idle",
      isPanning: getInteractionState().type === "panning",
    });

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
    setCursor: (cursor) => hoverInteraction.setCursor(cursor),
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
    setCursor: (cursor) => hoverInteraction.setCursor(cursor),
  });
  const panningDragEndExecutor = createPanningDragEndExecutor({
    flushOffset: () => viewportInteraction.flushOffset(),
    dispatchInteraction,
    setCursor: (cursor) => hoverInteraction.setCursor(cursor),
    getIdleCursor: () => (tool === "pan" ? "grab" : ""),
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
    forceHistorySave: canvasCommands.history.finishCapture,
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
    setViewport: (updater) => {
      if (runtime) {
        runtime.camera.setViewport(updater(runtime.camera.getViewport()));
      } else {
        setViewport(updater);
      }
    },
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
    executor: canvasWheelExecutor,
  });
  const canvasWheelRouteHandler = createCanvasWheelRouteHandler({
    handler: canvasWheelHandler,
  });
  const updateEdgeScroll = (clientPoint: { x: number; y: number }) => {
    if (!edgeScroll) return;
    const isEnabled = () => {
      const type = getInteractionState().type;
      return (
        type === "selecting" ||
        type === "structuredMoving" ||
        type === "structuredRectResizing" ||
        type === "structuredSplitBoxResizing" ||
        type === "structuredSplitBoxResizePending" ||
        type === "structuredLineResizing"
      );
    };
    edgeScroll.update({
      clientPoint,
      getBounds: () => containerRef.current?.getBoundingClientRect() ?? null,
      isEnabled,
      onCameraMove: () => {
        if (!isEnabled()) return;
        const state = getInteractionState();
        const currentGrid = pointerContext.resolveClampedGridPoint(
          clientPoint.x,
          clientPoint.y
        );
        if (!currentGrid) return;
        dragUpdateHandler({
          state,
          tool,
          canvasMode,
          currentGrid,
          structuredScene,
        });
      },
    });
  };
  const bind = useCanvasGestureAdapter({
    beginInteraction,
    cancelInteraction,
    completeInteraction,
    stopEdgeScroll: () => edgeScroll?.stop(),
    updateEdgeScroll,
    containerRef,
    canvasMode,
    tool,
    brushChar,
    zoom,
    offset,
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
