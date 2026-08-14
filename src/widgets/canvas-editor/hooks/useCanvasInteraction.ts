import { useCreation } from "ahooks";
import { useEffect, useLayoutEffect, useRef } from "react";
import { GridManager } from "@/shared/utils/grid";
import { useCanvasRuntime } from "@/domains/canvas/public";
import {
  useEditor,
  type CanvasInteractionState,
} from "@/domains/editor/public";
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
  createPrimaryDragEndExecutor,
  createPrimaryDragEndHandler,
} from "./interaction/gestures/dragEndExecution";
import {
  createDragUpdateExecutor,
  createDragUpdateHandler,
} from "./interaction/gestures/dragUpdateExecution";
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
import {
  createCanvasInteractionPort,
  InteractionStateCapture,
} from "./interaction/canvasInteractionPort";



export const useCanvasInteraction = (
  store: ReturnType<typeof useCanvasEditorModels>["interaction"],
  containerRef: React.RefObject<HTMLDivElement | null>,
  setHoveredLink: (hit: CanvasLinkHit | null) => void,
  structuredMovePreviewRef?: React.MutableRefObject<StructuredMovePreview | null>,
  requestRenderRef?: React.MutableRefObject<(() => void) | null>,
  runtime?: CanvasEngineRuntime
) => {
  const canvas = useCanvasRuntime();
  const editorRuntime = useEditor();
  const {
    tool,
    brushChar,
    setBrushColor,
    setBrushBackgroundColor,
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
    selections,
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
    cancelInteractionEffects,
    colorPickerClickRef,
    completeInteraction,
    draggingSelection,
    edgeScroll,
    hoverInteraction,
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
    editorRuntime,
  });
  const shouldIgnoreActiveGestureEvent = (event: Event | undefined) =>
    shouldIgnoreActiveCanvasGesture({
      event,
      interactionMode: editorRuntime.getInteractionState().type,
      hasDragStartGrid: editorRuntime.getInteractionState().type !== "idle",
      isPanning: editorRuntime.getInteractionState().type === "panning",
    });
  const interactionCapture = useCreation(() => new InteractionStateCapture(), []);
  const setInteractionState = (state: CanvasInteractionState) => {
    interactionCapture.setState(state);
  };
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
    setInteractionState,
    setCursor: (cursor) => hoverInteraction.setCursor(cursor),
  });
  const dragStartRouteHandler = createDragStartRouteHandler({
    panning: panningDragStartExecutor,
  });
  const selectionDragStartExecutor = createSelectionDragStartExecutor({
    setAnchorGrid: (point) => interactionCapture.setSelectionAnchor(point),
    setInteractionState,
    clearInteractionState,
    clearSelections,
    setSelectionPreview: (selection) => selectionPreview.set(selection),
    clearTextCursor: () => setTextCursor(null),
  });
  const drawingShapeDragStartExecutor = createDrawingShapeDragStartExecutor({
    setAnchorGrid: (point) => interactionCapture.setSelectionAnchor(point),
    setInteractionState,
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
    setInteractionState,
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
    setInteractionState,
    setSelectionPreview: (selection) => selectionPreview.set(selection),
    draw: () => undefined,
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
    forceHistorySave: canvas.commands.history.finishCapture,
    commitStructuredShape,
    resetDragState,
  });
  const primaryDragEndHandler = createPrimaryDragEndHandler({
    executor: primaryDragEndExecutor,
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
        setBrushBackgroundColor,
        setSelectionForegroundColor:
          canvas.commands.selection.setForegroundColor,
        setSelectionBackgroundColor:
          canvas.commands.selection.setBackgroundColor,
        setStructuredTextColor,
        setStructuredSelectionPrimaryColor:
          canvas.commands.structured.setSelectionPrimaryColor,
        clearColorPickerTarget: () => setCanvasColorPickerTarget(null),
        clearHoveredGrid: () => setHoveredGrid(null),
        resetDragState,
        setCursor: (cursor) => hoverInteraction.setCursor(cursor),
      }),
    [
      hoverInteraction,
      canvas,
      resetDragState,
      setBrushColor,
      setBrushBackgroundColor,
      setCanvasColorPickerTarget,
      setHoveredGrid,
      setStructuredTextColor,
    ]
  );
  const colorPickerDragStartHandler = createColorPickerDragStartHandler({
    target: canvasColorPickerTarget,
    isStructuredTextSelectionActive:
      canvasMode === "structured" && !!structuredTextSelection,
    isStructuredNodeSelectionActive:
      canvasMode === "structured" && selectedStructuredNodeIds.length > 0,
    isFreeformSelectionActive:
      canvasMode === "freeform" && selections.length > 0,
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
        getInteractionMode: () => editorRuntime.getInteractionState().type,
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
  const coreInteractionPort = useCreation(
    () =>
      createCanvasInteractionPort({
        capture: interactionCapture,
        tool,
        canvasMode,
        brushChar,
        structuredScene,
        pointerContext,
        dragStart: canvasDragStartRouteAdapter,
        dragUpdate: dragUpdateHandler,
        dragEnd: primaryDragEndHandler,
        beginInteraction,
        completeInteraction,
        cancelInteraction: cancelInteractionEffects,
        queuePan: ({ x, y }) => viewportInteraction.queueOffsetDelta(x, y),
        flushPan: () => viewportInteraction.flushOffset(),
        clearLinkHover: () => hoverInteraction.clearLinkHover(),
        setCursor: (cursor) => hoverInteraction.setCursor(cursor),
        addScratchPoints,
        erasePoints: (points) => erasePoints(points, false),
        setHoveredGrid,
      }),
    [
      addScratchPoints,
      brushChar,
      canvasMode,
      completeInteraction,
      erasePoints,
      hoverInteraction,
      primaryDragEndHandler,
      setHoveredGrid,
      structuredScene,
      tool,
      viewportInteraction,
      beginInteraction,
      cancelInteractionEffects,
      canvasDragStartRouteAdapter,
      dragUpdateHandler,
      pointerContext,
    ]
  );
  const coreInteractionPortRef = useRef(coreInteractionPort);
  useLayoutEffect(() => {
    coreInteractionPortRef.current = coreInteractionPort;
  }, [coreInteractionPort]);
  useEffect(() => {
    const unbind = editorRuntime.interactionPort.bindRef(coreInteractionPortRef);
    return () => {
      editorRuntime.dispatch({
        type: "canvas-interaction-cancel",
        reason: "dispose",
      });
      unbind();
    };
  }, [editorRuntime]);
  const updateEdgeScroll = (clientPoint: { x: number; y: number }) => {
    if (!edgeScroll) return;
    const isEnabled = () => {
      const type = editorRuntime.getInteractionState().type;
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
        const currentGrid = pointerContext.resolveClampedGridPoint(
          clientPoint.x,
          clientPoint.y
        );
        if (!currentGrid) return;
        editorRuntime.dispatch({
          type: "canvas-drag-update",
          delta: { x: 0, y: 0 },
          currentGrid,
        });
      },
    });
  };
  const bind = useCanvasGestureAdapter({
    cancelInteraction,
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
    editorRuntime,
    getInteractionState: editorRuntime.getInteractionState,
    hoverInteraction,
    shouldIgnoreActiveGestureEvent,
    canvasPinchRouteHandler,
    canvasMoveRouteHandler,
    canvasDragStartRouteAdapter,
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
