import { useRef, type RefObject } from "react";
import { useGesture } from "@use-gesture/react";
import type { CanvasMode } from "@/domains/sessions/public";
import type { ToolType } from "@/domains/canvas/public";
import type { StructuredNode } from "@/domains/structured-content/public";
import { isCtrlOrMeta } from "@/shared/utils/event";
import { MAX_ZOOM, MIN_ZOOM } from "@/shared/lib/constants";
import {
  isStructuredSplitBoxLineHandle,
} from "@/domains/structured-content/public";
import type { CanvasPointerContextResolver } from "../core/pointerContext";
import type { CanvasInteractionRuntime } from "../core/interactionRuntime";
import type { HoverInteractionController } from "../preview/hoverInteractionController";
import type { CanvasPinchRouteHandler } from "./pinchInteraction";
import type { CanvasMoveRouteHandler } from "./moveExecution";
import type { CanvasDragStartRouteAdapter } from "./dragStartExecution";
import type {
  DragUpdateHandler,
  DragUpdateRouteHandler,
} from "./dragUpdateExecution";
import type {
  DragEndRouteHandler,
  PrimaryDragEndHandler,
} from "./dragEndExecution";
import type { CanvasClickRouteHandler } from "./clickExecution";
import type { CanvasWheelRouteHandler } from "./wheelInteraction";
import { shouldIgnoreCanvasSurfaceGesture } from "../core/gestureGuards";
import { shouldOpenCanvasLink } from "../core/hitTesting";

export const useCanvasGestureAdapter = ({
  containerRef,
  canvasMode,
  tool,
  brushChar,
  zoom,
  hasColorPickerTarget,
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
  resetDragState,
  canvasClickRouteHandler,
  canvasWheelRouteHandler,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  canvasMode: CanvasMode;
  tool: ToolType;
  brushChar: string;
  zoom: number;
  hasColorPickerTarget: boolean;
  selectedStructuredNodeIds: string[];
  structuredScene: StructuredNode[];
  editingStructuredTextNodeId: string | null;
  pointerContext: CanvasPointerContextResolver;
  interactionRuntime: CanvasInteractionRuntime;
  hoverInteraction: HoverInteractionController;
  shouldIgnoreActiveGestureEvent: (event: Event | undefined) => boolean;
  canvasPinchRouteHandler: CanvasPinchRouteHandler;
  canvasMoveRouteHandler: CanvasMoveRouteHandler;
  canvasDragStartRouteAdapter: CanvasDragStartRouteAdapter;
  dragUpdateRouteHandler: DragUpdateRouteHandler;
  dragUpdateHandler: DragUpdateHandler;
  dragEndRouteHandler: DragEndRouteHandler;
  primaryDragEndHandler: PrimaryDragEndHandler;
  resetDragState: () => void;
  canvasClickRouteHandler: CanvasClickRouteHandler;
  canvasWheelRouteHandler: CanvasWheelRouteHandler;
}) => {
  const pinchStartZoomRef = useRef(zoom);

  return useGesture(
    {
      onPinchStart: () => {
        pinchStartZoomRef.current = zoom;
      },
      onPinch: ({ offset: [scale], origin: [ox, oy], event }) => {
        canvasPinchRouteHandler({
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
      onMove: ({ xy: [x, y], event }) => {
        if (shouldIgnoreCanvasSurfaceGesture(event)) return;
        if (interactionRuntime.getState().type === "panning") return;
        canvasMoveRouteHandler({
          hasColorPickerTarget,
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
          hasColorPickerTarget,
          hasCanvasRect: pointerContext.hasCanvasRect(),
          screenPoint,
          shiftKey: mouseEvent.shiftKey,
          anchorGrid: interactionRuntime.getSelectionAnchor(),
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
        const state = interactionRuntime.getState();
        dragUpdateRouteHandler({
          state,
          delta: { x: dx, y: dy },
          resolveCurrentGrid: () => pointerContext.resolveGridPoint(x, y),
          executePrimaryUpdate: (currentGrid) =>
            dragUpdateHandler({
              state,
              tool,
              canvasMode,
              currentGrid,
                  structuredScene,
            }),
        });
      },
      onDragEnd: ({ event, xy: [x, y], canceled }) => {
        if (shouldIgnoreActiveGestureEvent(event)) return;
        if (
          canceled ||
          event.type === "pointercancel" ||
          event.type === "lostpointercapture"
        ) {
          resetDragState();
          return;
        }
        const state = interactionRuntime.getState();
        dragEndRouteHandler({
          state,
          button: (event as MouseEvent).button,
          executePrimaryEnd: () => {
            primaryDragEndHandler({
              state,
              tool,
              canvasMode,
              structuredScene,
              resolvedEndGrid: pointerContext.resolveGridPoint(x, y),
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
      onWheel: ({
        xy: [clientX, clientY],
        delta: [gestureDeltaX, gestureDeltaY],
        event,
      }) => {
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
      drag: { pointer: { capture: true } },
      pinch: { pinchOnWheel: false },
    }
  );
};
