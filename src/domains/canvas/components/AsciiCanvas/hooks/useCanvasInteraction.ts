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
} from "./interaction/gestures/clickExecution";
import {
  createColorPickerDragStartExecutor,
  createColorPickerDragStartHandler,
} from "./interaction/gestures/colorPickerInteraction";
import { resolveCanvasMoveDecision } from "./interaction/gestures/moveInteraction";
import {
  createCanvasMoveExecutor,
  executeCanvasMoveDecision,
} from "./interaction/gestures/moveExecution";
import {
  createCanvasPinchExecutor,
  executeCanvasPinchDecision,
  resolveCanvasPinchDecision,
} from "./interaction/gestures/pinchInteraction";
import {
  createCanvasWheelExecutor,
  executeCanvasWheelDecision,
  resolveCanvasWheelDecision,
} from "./interaction/gestures/wheelInteraction";
import {
  createNonPanningDragEndExecutor,
  createPanningDragEndExecutor,
  createPrimaryDragEndExecutor,
  executeNonPanningDragEndCleanup,
  executePanningDragEnd,
  executePrimaryDragEnd,
  resolvePrimaryDragEndContext,
} from "./interaction/gestures/dragEndExecution";
import { resolveDragUpdateDecision } from "./interaction/gestures/dragUpdateInteraction";
import {
  createPanningDragUpdateExecutor,
  createDragUpdateExecutor,
  executeDragUpdateDecision,
  executePanningDragUpdate,
} from "./interaction/gestures/dragUpdateExecution";
import { createDragResetController } from "./interaction/gestures/dragResetExecution";
import {
  createStructuredPreviewQueueController,
  type StructuredPreviewQueueController,
} from "./interaction/structured/structuredPreviewQueueExecution";
import { resolveDrawingUpdateDecision } from "./interaction/gestures/drawingInteraction";
import {
  createPanningDragStartExecutor,
  createDrawingShapeDragStartExecutor,
  createSelectionDragStartExecutor,
  executePanningDragStart,
  executePrimaryCanvasDragStart,
} from "./interaction/gestures/dragStartExecution";
import { type StructuredNodeDragPayload } from "./interaction/structured/structuredDragStart";
import {
  createStructuredSelectStartHandler,
  createStructuredSelectStartExecutor,
} from "./interaction/structured/structuredSelectExecution";
import { createStructuredEditController } from "./interaction/structured/structuredEditExecution";
import {
  resolveDragStartRouteDecision,
} from "./interaction/gestures/dragStartInteraction";
import {
  createHoverInteractionController,
  type HoverInteractionController,
} from "./interaction/preview/hoverInteractionController";
import { shouldIgnoreMinimapGesture } from "./interaction/core/gestureGuards";
import { createCanvasPointerContextResolver } from "./interaction/core/pointerContext";
import {
  isFromCanvasUi,
  isFromMinimap,
  shouldOpenCanvasLink,
} from "./interaction/core/hitTesting";
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



  const shouldIgnoreMinimapGestureEvent = (event: Event | undefined) =>
    shouldIgnoreMinimapGesture({
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
    () => (currentGrid: Point) => {
      const decision = resolveDrawingUpdateDecision({
        tool,
        brushChar,
        lastGrid: lastGrid.current,
        currentGrid,
        lastPlacedGrid: lastPlacedGrid.current,
      });
      if (decision.type === "none") return;

      if (decision.type === "scratch" && decision.points.length > 0) {
        addScratchPoints(decision.points);
      } else if (decision.type === "erase") {
        erasePoints(decision.points, false);
      }
      lastGrid.current = decision.nextLastGrid;
      lastPlacedGrid.current = decision.nextLastPlacedGrid;
    },
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
  const panningDragStartExecutor = createPanningDragStartExecutor({
    isPanning: isPanningRef,
    dispatchInteraction,
    setBodyCursor: (cursor) => {
      document.body.style.cursor = cursor;
    },
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
  const canvasPinchExecutor = createCanvasPinchExecutor({
    setZoom,
    setOffset,
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
  const canvasMoveExecutor = createCanvasMoveExecutor({
    updateColorPickerHover: (hoverPoint) =>
      hoverInteraction.updateColorPickerHover(hoverPoint),
    updateLinkHover: (hit, hoverEvent) =>
      hoverInteraction.updateLinkHover(hit, hoverEvent),
    setHoveredGrid,
    setCursor: (cursor) => hoverInteraction.setCursor(cursor),
  });
  const canvasWheelExecutor = createCanvasWheelExecutor({
    preventDefault: () => undefined,
    flushOffset: () => viewportInteraction.flushOffset(),
    queueZoomDelta: (deltaZoom, mouseX, mouseY) =>
      viewportInteraction.queueZoomDelta(deltaZoom, mouseX, mouseY),
    queueOffsetDelta: (dx, dy) => viewportInteraction.queueOffsetDelta(dx, dy),
  });
  const pinchStartZoomRef = useRef(zoom);

  const bind = useGesture(
    {
      onPinchStart: () => {
        pinchStartZoomRef.current = zoom;
      },
      onPinch: ({ offset: [scale], origin: [ox, oy], event }) => {
        event.preventDefault();
        const anchor = pointerContext.resolveLocalPoint(ox, oy);
        if (!anchor) return;

        executeCanvasPinchDecision(
          resolveCanvasPinchDecision({
            canvasMode,
            pinchStartZoom: pinchStartZoomRef.current,
            scale,
            currentZoom: zoom,
            anchor,
            zoomBounds: { min: MIN_ZOOM, max: MAX_ZOOM },
          }),
          canvasPinchExecutor
        );
      },
      onPinchEnd: () => {
        // Pinch gesture ended
      },
      onMove: ({ xy: [x, y], event }) => {
        if (isFromCanvasUi(event)) return;
        if (isFromMinimap(event)) return;
        const moveContext = pointerContext.resolveMoveContext({
          clientX: x,
          clientY: y,
          shouldResolveStructuredSelectCursor:
            canvasMode === "structured" && tool === "select",
          shouldResolveEraserHoverPoint: tool === "eraser",
          selectedStructuredNodeIds,
          structuredScene,
          editingStructuredTextNodeId,
        });

        executeCanvasMoveDecision(
          resolveCanvasMoveDecision({
            hasColorPickerTarget: !!canvasColorPickerTarget,
            canvasMode,
            tool,
            point: moveContext.point,
            linkHit: moveContext.linkHit,
            structuredSelectCursor: moveContext.structuredSelectCursor,
            eraserHoverPoint: moveContext.eraserHoverPoint,
          }),
          canvasMoveExecutor,
          event as MouseEvent
        );
      },
      onDragStart: ({ xy: [x, y], event }) => {
        if (isFromCanvasUi(event)) return;
        if (isFromMinimap(event)) return;
        hoverInteraction.clearLinkHover(event as MouseEvent);
        const mouseEvent = event as MouseEvent;
        const routeDecision = resolveDragStartRouteDecision({
          canvasMode,
          tool,
          button: mouseEvent.button,
          isCtrlOrMetaPressed: isCtrlOrMeta(mouseEvent),
          hasColorPickerTarget: !!canvasColorPickerTarget,
          hasCanvasRect: pointerContext.hasCanvasRect(),
        });

        switch (routeDecision.type) {
          case "color-picker":
            colorPickerDragStartHandler({
              point: pointerContext.resolveGridPoint(x, y),
              preventDefault: () => event.preventDefault(),
            });
            return;
          case "pan":
            executePanningDragStart({ x, y }, panningDragStartExecutor);
            return;
          case "ignore":
            return;
          case "primary-canvas":
            break;
        }

        const start = pointerContext.resolveGridPoint(x, y);
        if (!start) return;

        executePrimaryCanvasDragStart(
          {
            start,
            canvasMode,
            tool,
            shiftKey: mouseEvent.shiftKey,
            anchorGrid: anchorGrid.current,
            canvasBounds,
            brushChar,
            executeStructuredSelectStart: () =>
              structuredSelectStartHandler({
                screenPoint: pointerContext.resolveLocalPoint(x, y),
                start,
                mouseDetail: mouseEvent.detail,
              }),
          },
          {
            selection: selectionDragStartExecutor,
            drawingShape: drawingShapeDragStartExecutor,
          }
        );
      },
      onDrag: ({ xy: [x, y], delta: [dx, dy], event }) => {
        if (isFromCanvasUi(event)) return;
        if (shouldIgnoreMinimapGestureEvent(event)) return;
        if (getInteractionMode() === "panning") {
          executePanningDragUpdate({ x: dx, y: dy }, panningDragUpdateExecutor);
          return;
        }

        if (dragStartGrid.current) {
          const currentGrid = pointerContext.resolveGridPoint(x, y);
          if (!currentGrid) return;

          const dragUpdateDecision = resolveDragUpdateDecision({
            mode: getInteractionMode(),
            tool,
            canvasMode,
            dragStart: dragStartGrid.current,
            currentGrid,
            canvasBounds,
            drag: structuredNodeDragRef.current,
            structuredScene,
            textSelectionStart: structuredTextSelectionStartRef.current,
            lineAxis: lineAxisRef.current,
          });

          executeDragUpdateDecision(dragUpdateDecision, dragUpdateExecutor, {
            currentGrid,
            tool,
            structuredScene,
            updateEraserHover: tool === "eraser",
          });
        }
      },
      onDragEnd: ({ event, xy: [x, y] }) => {
        if (isFromCanvasUi(event)) return;
        if (shouldIgnoreMinimapGestureEvent(event)) return;
        const mode = getInteractionMode();
        if (mode === "panning") {
          executePanningDragEnd(panningDragEndExecutor);
          return;
        }
        if ((event as MouseEvent).button === 0) {
          const drag = structuredNodeDragRef.current;
          const startGrid = dragStartGrid.current;
          executePrimaryDragEnd(
            resolvePrimaryDragEndContext({
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
            }),
            primaryDragEndExecutor
          );
        }
        executeNonPanningDragEndCleanup(nonPanningDragEndExecutor);
      },
      onClick: ({ event }) => {
        if (isFromCanvasUi(event)) return;
        if (isFromMinimap(event)) return;
        const mouseEvent = event as MouseEvent;
        canvasClickHandler({
          point: pointerContext.resolveGridPoint(
            mouseEvent.clientX,
            mouseEvent.clientY
          ),
          linkHit: pointerContext.resolveLinkHit(
            mouseEvent.clientX,
            mouseEvent.clientY
          ),
          shouldOpenLink: shouldOpenCanvasLink(mouseEvent),
          preventDefault: () => event.preventDefault(),
        });
      },
      onWheel: ({ xy: [clientX, clientY], delta: [gestureDeltaX, gestureDeltaY], event }) => {
        if (isFromCanvasUi(event)) return;
        if (isFromMinimap(event)) return;
        const anchor = pointerContext.resolveLocalPoint(clientX, clientY);
        if (!anchor) return;

        const wheelEvent = event as WheelEvent;
        executeCanvasWheelDecision(
          resolveCanvasWheelDecision({
            isCtrlOrMetaPressed: isCtrlOrMeta(event),
            canvasMode,
            deltaX: wheelEvent.deltaX ?? gestureDeltaX,
            deltaY: wheelEvent.deltaY ?? gestureDeltaY,
            shiftKey: wheelEvent.shiftKey,
            anchor,
          }),
          {
            ...canvasWheelExecutor,
            preventDefault: () => event.preventDefault(),
          }
        );
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
    if (isFromCanvasUi(event.nativeEvent)) return;
    if (isFromMinimap(event.nativeEvent)) return;
    if (structuredEditController.startEdit(event.clientX, event.clientY)) {
      event.preventDefault();
    }
  };

  return { bind, draggingSelection, handleDoubleClick };
};
