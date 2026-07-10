import { useEffect, useRef, useState } from "react";
import { useGesture } from "@use-gesture/react";
import { useCreation, useThrottleFn } from "ahooks";
import { GridManager } from "@/shared/utils/grid";
import type { Point, SelectionArea } from "@/shared/types";
import type { CanvasState } from "@/domains/canvas/state/canvasStore";
import { forceHistorySave } from "@/shared/lib/yjs-setup";
import { isCtrlOrMeta } from "@/shared/utils/event";
import { MIN_ZOOM, MAX_ZOOM } from "@/shared/lib/constants";
import { type CanvasLinkHit } from "./interaction/core/linkHitTesting";
import { isStructuredSplitBoxLineHandle } from "@/domains/canvas/state/helpers/structuredBoxEditing";
import { type StructuredMovePreview } from "./interaction/structured/structuredInteractionPreview";

import {
  createViewportInteractionController,
  type ViewportInteractionController,
} from "./interaction/viewport/viewportInteractionController";
import {
  createSelectionPreviewController,
  type SelectionPreviewController,
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
  type StructuredPreviewQueueController,
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
import { type StructuredNodeDragPayload } from "./interaction/structured/structuredDragStart";
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
  type HoverInteractionController,
} from "./interaction/preview/hoverInteractionController";
import {
  shouldIgnoreActiveCanvasGesture,
  shouldIgnoreCanvasSurfaceGesture,
} from "./interaction/core/gestureGuards";
import { createCanvasPointerContextResolver } from "./interaction/core/pointerContext";
import { shouldOpenCanvasLink } from "./interaction/core/hitTesting";
export { shouldOpenCanvasLink, shouldUseCanvasLinkPointer } from "./interaction/core/hitTesting";
import {
  INITIAL_INTERACTION_STATE,
  toLegacyInteractionMode,
  transitionInteractionState,
  type InteractionEvent,
  type InteractionState,
} from "./interaction/core/interactionMachine";



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

  const pointerContext = createCanvasPointerContextResolver({
    getRect: () => containerRef.current?.getBoundingClientRect(),
    getViewport: () => ({ offset, zoom }),
    getGrid: () => grid,
    getCanvasMode: () => canvasMode,
    getCanvasBounds: () => canvasBounds,
  });
  const dragStartGrid = useRef<Point | null>(null);
  const lastGrid = useRef<Point | null>(null);
  const lastPlacedGrid = useRef<Point | null>(null);
  const anchorGrid = useRef<Point | null>(null);

  const isPanningRef = useRef(false);
  const canvasModeRef = useRef(canvasMode);
  canvasModeRef.current = canvasMode;
  const viewportInteractionRef =
    useRef<ViewportInteractionController | null>(null);
  const interactionStateRef = useRef<InteractionState>(INITIAL_INTERACTION_STATE);
  const lineAxisRef = useRef<"vertical" | "horizontal" | null>(null);
  const structuredNodeDragRef = useRef<StructuredNodeDragPayload | null>(null);
  const structuredPreviewQueueRef =
    useRef<StructuredPreviewQueueController | null>(null);
  const structuredTextSelectionStartRef = useRef<{
    nodeId: string;
    offset: number;
  } | null>(null);
  const hoverInteractionRef =
    useRef<HoverInteractionController | null>(null);
  const colorPickerClickRef = useRef(false);
  const selectionPreviewRef =
    useRef<SelectionPreviewController | null>(null);
  const fallbackStructuredMovePreviewRef =
    useRef<StructuredMovePreview | null>(null);
  const fallbackRequestRenderRef = useRef<(() => void) | null>(null);
  const activeStructuredMovePreviewRef =
    structuredMovePreviewRef ?? fallbackStructuredMovePreviewRef;
  const activeRequestRenderRef = requestRenderRef ?? fallbackRequestRenderRef;
  const [draggingSelection, setDraggingSelectionState] =
    useState<SelectionArea | null>(null);

  if (!hoverInteractionRef.current) {
    hoverInteractionRef.current = createHoverInteractionController({
      getContainer: () => containerRef.current,
      setHoveredLink,
      setHoveredGrid,
    });
  }
  const hoverInteraction = hoverInteractionRef.current;
  if (!selectionPreviewRef.current) {
    selectionPreviewRef.current = createSelectionPreviewController({
      setPreview: setDraggingSelectionState,
    });
  }
  const selectionPreview = selectionPreviewRef.current;

  if (!viewportInteractionRef.current) {
    viewportInteractionRef.current = createViewportInteractionController({
      setOffset,
      setZoom,
      getCanvasMode: () => canvasModeRef.current,
      zoomBounds: { min: MIN_ZOOM, max: MAX_ZOOM },
    });
  }
  const viewportInteraction = viewportInteractionRef.current;

  const dispatchInteraction = (event: InteractionEvent) => {
    interactionStateRef.current = transitionInteractionState(
      interactionStateRef.current,
      event
    );
  };

  const getInteractionMode = () =>
    toLegacyInteractionMode(interactionStateRef.current);

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
      interactionMode: getInteractionMode(),
      hasDragStartGrid: dragStartGrid.current !== null,
      isPanning: isPanningRef.current,
    });

  if (!structuredPreviewQueueRef.current) {
    structuredPreviewQueueRef.current = createStructuredPreviewQueueController({
      setStructuredMovePreview,
      applyStructuredScene,
      clearStructuredMovePreview,
    });
  }
  const structuredPreviewQueue = structuredPreviewQueueRef.current;
  const resetDragState = createDragResetController({
    refs: {
      dragStartGrid,
      lastGrid,
      lastPlacedGrid,
      lineAxis: lineAxisRef,
      structuredNodeDrag: structuredNodeDragRef,
      structuredTextSelectionStart: structuredTextSelectionStartRef,
    },
    structuredPreviewQueue,
    clearStructuredMovePreview,
    dispatchInteraction,
  }).reset;
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
  }, []);

  useEffect(() => {
    return () => {
      viewportInteraction.cancel();
      structuredPreviewQueue.cancel();
      selectionPreview.cancel();
    };
  }, []);

  const handleDrawing = useCreation(
    () =>
      createDrawingUpdateHandler({
        getTool: () => tool,
        getBrushChar: () => brushChar,
        lastGrid,
        lastPlacedGrid,
        executor: {
          addScratchPoints,
          erasePoints: (points) => erasePoints(points, false),
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
    isPanning: isPanningRef,
    dispatchInteraction,
    setBodyCursor: (cursor) => {
      document.body.style.cursor = cursor;
    },
  });
  const dragStartRouteHandler = createDragStartRouteHandler({
    panning: panningDragStartExecutor,
  });
  const selectionDragStartExecutor = createSelectionDragStartExecutor({
    anchorGrid,
    dragStartGrid,
    dispatchInteraction,
    clearInteractionState,
    clearSelections,
    setSelectionPreview: (selection) => selectionPreview.set(selection),
    clearTextCursor: () => setTextCursor(null),
  });
  const drawingShapeDragStartExecutor = createDrawingShapeDragStartExecutor({
    dragStartGrid,
    lastGrid,
    lastPlacedGrid,
    anchorGrid,
    lineAxis: lineAxisRef,
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
    dragStartGrid,
    structuredNodeDrag: structuredNodeDragRef,
    structuredTextSelectionStart: structuredTextSelectionStartRef,
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
    lineAxis: lineAxisRef,
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
      document.body.style.cursor = cursor;
    },
  });
  const panningDragEndExecutor = createPanningDragEndExecutor({
    isPanning: isPanningRef,
    flushOffset: () => viewportInteraction.flushOffset(),
    dispatchInteraction,
    setBodyCursor: (cursor) => {
      document.body.style.cursor = cursor;
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
  const colorPickerDragStartExecutor = createColorPickerDragStartExecutor({
    colorPickerClick: colorPickerClickRef,
    preventDefault: () => undefined,
    setBrushColor,
    setStructuredTextColor,
    clearColorPickerTarget: () => setCanvasColorPickerTarget(null),
    clearHoveredGrid: () => setHoveredGrid(null),
    resetDragState,
    setCursor: (cursor) => hoverInteraction.setCursor(cursor),
  });
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
  const canvasClickExecutor = createCanvasClickExecutor({
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
  });
  const canvasClickHandler = createCanvasClickHandler({
    getColorPickerClickPending: () => colorPickerClickRef.current,
    getInteractionMode,
    canvasMode,
    tool,
    executor: canvasClickExecutor,
  });
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
  const pinchStartZoomRef = useRef(zoom);

  const bind = useGesture(
    {
      onPinchStart: () => {
        pinchStartZoomRef.current = zoom;
      },
      onPinch: ({ offset: [scale], origin: [ox, oy], event }) => {
        canvasPinchRouteHandler({
          canvasMode,
          pinchStartZoom: pinchStartZoomRef.current,
          scale,
          currentZoom: zoom,
          origin: { x: ox, y: oy },
          zoomBounds: { min: MIN_ZOOM, max: MAX_ZOOM },
          preventDefault: () => event.preventDefault(),
          resolveAnchor: (origin) =>
            pointerContext.resolveLocalPoint(origin.x, origin.y),
        });
      },
      onPinchEnd: () => {
        // Pinch gesture ended
      },
      onMove: ({ xy: [x, y], event }) => {
        if (shouldIgnoreCanvasSurfaceGesture(event)) return;
        canvasMoveRouteHandler({
          hasColorPickerTarget: !!canvasColorPickerTarget,
          canvasMode,
          tool,
          clientPoint: { x, y },
          event: event as MouseEvent,
          resolveMoveContext: ({
            clientPoint,
            shouldResolveStructuredSelectCursor,
            shouldResolveEraserHoverPoint,
          }) =>
            pointerContext.resolveMoveContext({
              clientX: clientPoint.x,
              clientY: clientPoint.y,
              shouldResolveStructuredSelectCursor,
              shouldResolveEraserHoverPoint,
              selectedStructuredNodeIds,
              structuredScene,
              editingStructuredTextNodeId,
            }),
        });
      },
      onDragStart: ({ xy: [x, y], event }) => {
        if (shouldIgnoreCanvasSurfaceGesture(event)) return;
        hoverInteraction.clearLinkHover(event as MouseEvent);
        const mouseEvent = event as MouseEvent;
        const screenPoint = { x, y };
        canvasDragStartRouteAdapter({
          canvasMode,
          tool,
          button: mouseEvent.button,
          isCtrlOrMetaPressed: isCtrlOrMeta(mouseEvent),
          hasColorPickerTarget: !!canvasColorPickerTarget,
          hasCanvasRect: pointerContext.hasCanvasRect(),
          screenPoint,
          shiftKey: mouseEvent.shiftKey,
          anchorGrid: anchorGrid.current,
          canvasBounds,
          brushChar,
          mouseDetail: mouseEvent.detail,
          preventDefault: () => event.preventDefault(),
          resolveGridPoint: (point) =>
            pointerContext.resolveGridPoint(point.x, point.y),
          resolveLocalPoint: (point) =>
            pointerContext.resolveLocalPoint(point.x, point.y),
        });
      },
      onDrag: ({ xy: [x, y], delta: [dx, dy], event }) => {
        if (shouldIgnoreActiveGestureEvent(event)) return;
        const mode = getInteractionMode();
        dragUpdateRouteHandler({
          mode,
          delta: { x: dx, y: dy },
          dragStart: dragStartGrid.current,
          resolveCurrentGrid: () => pointerContext.resolveGridPoint(x, y),
          executePrimaryUpdate: (currentGrid, dragStart) =>
            dragUpdateHandler({
              mode,
              tool,
              canvasMode,
              dragStart,
              currentGrid,
              canvasBounds,
              drag: structuredNodeDragRef.current,
              structuredScene,
              textSelectionStart: structuredTextSelectionStartRef.current,
              lineAxis: lineAxisRef.current,
            }),
        });
      },
      onDragEnd: ({ event, xy: [x, y] }) => {
        if (shouldIgnoreActiveGestureEvent(event)) return;
        const mode = getInteractionMode();
        dragEndRouteHandler({
          mode,
          button: (event as MouseEvent).button,
          executePrimaryEnd: () => {
            const drag = structuredNodeDragRef.current;
            const startGrid = dragStartGrid.current;
            primaryDragEndHandler({
              mode,
              tool,
              canvasMode,
              structuredScene,
              dragStart: startGrid,
              resolvedEndGrid: pointerContext.resolveGridPoint(x, y),
              axis: lineAxisRef.current,
              dragNodeType: drag?.node.type ?? null,
              dragHandle: drag?.handle ?? null,
              isDividerHandle: isStructuredSplitBoxLineHandle,
            });
          },
        });
      },
      onClick: ({ event }) => {
        if (shouldIgnoreCanvasSurfaceGesture(event)) return;
        const mouseEvent = event as MouseEvent;
        canvasClickRouteHandler({
          clientPoint: { x: mouseEvent.clientX, y: mouseEvent.clientY },
          preventDefault: () => event.preventDefault(),
          resolveGridPoint: (clientPoint) =>
            pointerContext.resolveGridPoint(clientPoint.x, clientPoint.y),
          resolveLinkHit: (clientPoint) =>
            pointerContext.resolveLinkHit(clientPoint.x, clientPoint.y),
          shouldOpenLink: () => shouldOpenCanvasLink(mouseEvent),
        });
      },
      onWheel: ({ xy: [clientX, clientY], delta: [gestureDeltaX, gestureDeltaY], event }) => {
        if (shouldIgnoreCanvasSurfaceGesture(event)) return;
        const wheelEvent = event as WheelEvent;
        canvasWheelRouteHandler({
          isCtrlOrMetaPressed: isCtrlOrMeta(event),
          gestureDeltaX,
          gestureDeltaY,
          eventDeltaX: wheelEvent.deltaX,
          eventDeltaY: wheelEvent.deltaY,
          shiftKey: wheelEvent.shiftKey,
          origin: { x: clientX, y: clientY },
          preventDefault: () => event.preventDefault(),
          resolveAnchor: (origin) =>
            pointerContext.resolveLocalPoint(origin.x, origin.y),
        });
      },
    },
    {
      target: containerRef,
      eventOptions: { passive: false },
      pinch: {
        pinchOnWheel: false,
      },
    }
  );

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    structuredEditRouteHandler({
      clientPoint: { x: event.clientX, y: event.clientY },
      shouldIgnore: () => shouldIgnoreCanvasSurfaceGesture(event.nativeEvent),
      preventDefault: () => event.preventDefault(),
    });
  };

  return { bind, draggingSelection, handleDoubleClick };
};
