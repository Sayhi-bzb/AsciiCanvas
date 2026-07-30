"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { useTheme } from "next-themes";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/domains/canvas/public";
import { useUiI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import { MAX_ZOOM, MIN_ZOOM } from "@/shared/lib/constants";
import type { Point } from "@/shared/types";
import { resolveCanvasWheelDecision } from "./hooks/interaction/gestures/wheelInteraction";
import { createViewportInteractionController } from "./hooks/interaction/viewport/viewportInteractionController";
import { createMinimapCameraAnimator } from "./minimap/cameraAnimation";
import {
  cameraCenterToOffset,
  expandMinimapRect,
  getRectCenter,
  isPointInMinimapRect,
  unionMinimapRects,
} from "./minimap/geometry";
import { MinimapManager } from "./minimap/MinimapManager";

const MINIMAP_DIMENSIONS = { width: 220, height: 140 } as const;
const MINIMAP_PADDING = 4;
const VIEWPORT_HIT_SLOP = 4;
const CLICK_JITTER_THRESHOLD_SQ = 4;
const CAMERA_ANIMATION_MS = 180;

type PointerSession = {
  pointerId: number;
  originScreenPoint: Point;
  originPagePoint: Point;
  originPageCenter: Point;
  isInViewport: boolean;
};

export const Minimap = ({
  containerSize,
}: {
  containerSize: { width: number; height: number } | undefined;
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const managerRef = useRef<MinimapManager | null>(null);
  const pointerSessionRef = useRef<PointerSession | null>(null);
  const endPointerSessionRef = useRef<() => void>(() => {});
  const [isViewportHovered, setIsViewportHovered] = useState(false);
  const [isDraggingViewport, setIsDraggingViewport] = useState(false);
  const { resolvedTheme } = useTheme();
  const { t } = useUiI18n();
  const {
    grid,
    offset,
    zoom,
    canvasMode,
    setOffset,
    setZoom,
  } = useEditorStore(
    useShallow((state) => ({
      grid: state.grid,
      offset: state.offset,
      zoom: state.zoom,
      canvasMode: state.canvasMode,
      setOffset: state.setOffset,
      setZoom: state.setZoom,
    }))
  );

  const cameraAnimator = useMemo(
    () => createMinimapCameraAnimator({ setOffset }),
    [setOffset]
  );
  const viewportInteraction = useMemo(
    () =>
      createViewportInteractionController({
        setOffset,
        setZoom,
        getCanvasMode: () => canvasMode,
        zoomBounds: { min: MIN_ZOOM, max: MAX_ZOOM },
      }),
    [canvasMode, setOffset, setZoom]
  );

  const removeDragEndListeners = useCallback(() => {
    const end = endPointerSessionRef.current;
    document.body.removeEventListener("pointerup", end);
    document.body.removeEventListener("pointercancel", end);
    document.body.removeEventListener("contextmenu", end, true);
  }, []);

  const endPointerSession = useCallback(() => {
    const session = pointerSessionRef.current;
    pointerSessionRef.current = null;
    setIsDraggingViewport(false);
    removeDragEndListeners();
    const canvas = canvasRef.current;
    if (
      session &&
      canvas?.hasPointerCapture?.(session.pointerId)
    ) {
      canvas.releasePointerCapture(session.pointerId);
    }
  }, [removeDragEndListeners]);

  useEffect(() => {
    endPointerSessionRef.current = endPointerSession;
  }, [endPointerSession]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    try {
      const manager = new MinimapManager(
        canvas,
        host,
        MINIMAP_DIMENSIONS,
        MINIMAP_PADDING
      );
      managerRef.current = manager;
      return () => {
        endPointerSession();
        manager.close();
        managerRef.current = null;
      };
    } catch (error) {
      console.error("Minimap initialization failed", error);
      return;
    }
  }, [endPointerSession]);

  useEffect(
    () => () => {
      cameraAnimator.cancel();
      viewportInteraction.cancel();
    },
    [cameraAnimator, viewportInteraction]
  );

  useEffect(() => {
    if (!containerSize) return;
    managerRef.current?.update({
      grid,
      offset,
      zoom,
      viewportSize: containerSize,
    });
  }, [containerSize, grid, offset, zoom]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      managerRef.current?.updateColors();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [resolvedTheme]);

  const addDragEndListeners = useCallback(() => {
    document.body.addEventListener("pointerup", endPointerSession);
    document.body.addEventListener("pointercancel", endPointerSession);
    document.body.addEventListener("contextmenu", endPointerSession, true);
  }, [endPointerSession]);

  const getCanvasPoint = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return rect ? { x: clientX - rect.left, y: clientY - rect.top } : null;
  };

  const moveCameraTo = useCallback(
    (center: Point, animated: boolean) => {
      if (!containerSize) return;
      const target = cameraCenterToOffset(center, zoom, containerSize);
      if (animated) {
        cameraAnimator.animateTo(target, CAMERA_ANIMATION_MS);
      } else {
        cameraAnimator.jumpTo(target);
      }
    },
    [cameraAnimator, containerSize, zoom]
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const manager = managerRef.current;
    const transform = manager?.getTransform();
    if (!manager || !transform || !manager.hasContent() || !containerSize) {
      return;
    }
    if (event.button !== 0) return;

    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const rawPoint = manager.getWorldPoint(event.clientX, event.clientY);
    if (!rawPoint) return;
    const commonBounds = unionMinimapRects(
      transform.contentBounds!,
      transform.viewportBounds
    );
    const allowedBounds = expandMinimapRect(
      commonBounds,
      transform.viewportBounds.width / 2,
      transform.viewportBounds.height / 2
    );
    const pointInViewport = isPointInMinimapRect(
      rawPoint,
      transform.viewportBounds
    );

    let originPagePoint: Point;
    let originPageCenter: Point;
    let isInViewport: boolean;

    if (isPointInMinimapRect(rawPoint, allowedBounds) && !pointInViewport) {
      originPagePoint = {
        x: rawPoint.x + transform.viewportBounds.width / 2,
        y: rawPoint.y + transform.viewportBounds.height / 2,
      };
      originPageCenter = rawPoint;
      isInViewport = false;
      moveCameraTo(rawPoint, true);
    } else {
      const clampedPoint = manager.getWorldPoint(
        event.clientX,
        event.clientY,
        { clampToWorld: true, clampToContent: true }
      );
      if (!clampedPoint) return;
      originPagePoint = clampedPoint;
      originPageCenter = getRectCenter(transform.viewportBounds);
      isInViewport = isPointInMinimapRect(
        clampedPoint,
        transform.viewportBounds
      );
    }

    pointerSessionRef.current = {
      pointerId: event.pointerId,
      originScreenPoint: { x: event.clientX, y: event.clientY },
      originPagePoint,
      originPageCenter,
      isInViewport,
    };
    setIsDraggingViewport(true);
    addDragEndListeners();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.stopPropagation();
    const manager = managerRef.current;
    if (!manager) return;
    const session = pointerSessionRef.current;

    if (session && session.pointerId === event.pointerId) {
      const dx = event.clientX - session.originScreenPoint.x;
      const dy = event.clientY - session.originScreenPoint.y;
      if (dx * dx + dy * dy <= CLICK_JITTER_THRESHOLD_SQ) return;

      const point = manager.getWorldPoint(event.clientX, event.clientY, {
        clampToWorld: true,
        clampToContent: true,
        axisOrigin: event.shiftKey ? session.originPagePoint : undefined,
      });
      if (!point) return;
      const center = session.isInViewport
        ? {
            x:
              point.x -
              (session.originPagePoint.x - session.originPageCenter.x),
            y:
              point.y -
              (session.originPagePoint.y - session.originPageCenter.y),
          }
        : point;
      moveCameraTo(center, false);
      event.preventDefault();
      return;
    }

    const canvasPoint = getCanvasPoint(event.clientX, event.clientY);
    const viewportRect = manager.getViewportRect();
    setIsViewportHovered(
      !!canvasPoint &&
        !!viewportRect &&
        isPointInMinimapRect(canvasPoint, viewportRect, VIEWPORT_HIT_SLOP)
    );
  };

  const handleDoubleClick = (
    event: React.MouseEvent<HTMLCanvasElement>
  ) => {
    const manager = managerRef.current;
    if (!manager?.hasContent()) return;
    event.stopPropagation();
    event.preventDefault();
    const point = manager.getWorldPoint(event.clientX, event.clientY);
    if (point) moveCameraTo(point, true);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    if (!containerSize) return;
    const decision = resolveCanvasWheelDecision({
      isCtrlOrMetaPressed: event.ctrlKey || event.metaKey,
      canvasMode,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      shiftKey: event.shiftKey,
      anchor: {
        x: containerSize.width / 2,
        y: containerSize.height / 2,
      },
    });
    if (decision.type === "none") return;

    event.preventDefault();
    event.stopPropagation();
    cameraAnimator.cancel();
    if (decision.type === "pan") {
      viewportInteraction.queueOffsetDelta(
        decision.delta.x,
        decision.delta.y
      );
      return;
    }
    viewportInteraction.flushOffset();
    viewportInteraction.queueZoomDelta(
      decision.deltaZoom,
      decision.anchor.x,
      decision.anchor.y
    );
  };

  const cursorClass = isDraggingViewport
    ? "cursor-grabbing"
    : isViewportHovered
      ? "cursor-grab"
      : "cursor-crosshair";

  return (
    <div
      ref={hostRef}
      data-minimap-root="true"
      className="size-fit overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        width={MINIMAP_DIMENSIONS.width}
        height={MINIMAP_DIMENSIONS.height}
        style={{
          width: `${MINIMAP_DIMENSIONS.width}px`,
          height: `${MINIMAP_DIMENSIONS.height}px`,
        }}
        role="img"
        aria-label={t("minimap.canvas")}
        data-testid="minimap-canvas"
        className={cn("block touch-none select-none", cursorClass)}
        onDoubleClick={handleDoubleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => {
          if (!pointerSessionRef.current) setIsViewportHovered(false);
        }}
        onPointerCancel={endPointerSession}
        onLostPointerCapture={endPointerSession}
        onWheelCapture={handleWheel}
      />
    </div>
  );
};
