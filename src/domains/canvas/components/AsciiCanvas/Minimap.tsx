"use client";

import { useEffect, useRef, useState } from "react";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { cn } from "@/shared/lib/utils";
import { uiClass } from "@/shared/styles/components";
import { DEFAULT_GRID_RENDER_METRICS } from "@/shared/metrics";
import {
  clampViewportRect,
  computeMinimapMeta,
  computeViewportRect,
  isPointInViewport,
  minimapPointToGrid,
} from "./minimap/geometry";
import type { MinimapMeta, ViewportRect } from "./minimap/types";
import { useShallow } from "zustand/react/shallow";

const MINIMAP_SIZE = 160;
const PADDING = 8;
const VIEWPORT_HIT_SLOP = 4;
const DRAG_THRESHOLD = 3;

type DragState = {
  active: boolean;
  pointerId: number | null;
  startClientX: number;
  startClientY: number;
  lastClientX: number;
  lastClientY: number;
  moved: boolean;
  viewportDrag: boolean;
};

const EMPTY_DRAG_STATE: DragState = {
  active: false,
  pointerId: null,
  startClientX: 0,
  startClientY: 0,
  lastClientX: 0,
  lastClientY: 0,
  moved: false,
  viewportDrag: false,
};

export const Minimap = ({
  containerSize,
}: {
  containerSize: { width: number; height: number } | undefined;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseLayerRef = useRef<HTMLCanvasElement | null>(null);
  const viewMetaRef = useRef<MinimapMeta | null>(null);
  const viewportRectRef = useRef<ViewportRect | null>(null);
  const dragStateRef = useRef<DragState>(EMPTY_DRAG_STATE);
  const suppressClickRef = useRef(false);
  const [isViewportHovered, setIsViewportHovered] = useState(false);
  const [isDraggingViewport, setIsDraggingViewport] = useState(false);
  const { grid, offset, zoom, setOffset } = useCanvasStore(
    useShallow((state) => ({
      grid: state.grid,
      offset: state.offset,
      zoom: state.zoom,
      setOffset: state.setOffset,
    }))
  );

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (
      (!grid || grid.size === 0) ||
      !containerSize
    ) {
      ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
      viewMetaRef.current = null;
      viewportRectRef.current = null;
      return;
    }

    const baseCanvas =
      baseLayerRef.current || document.createElement("canvas");
    baseLayerRef.current = baseCanvas;
    baseCanvas.width = MINIMAP_SIZE;
    baseCanvas.height = MINIMAP_SIZE;
    const baseCtx = baseCanvas.getContext("2d");
    if (!baseCtx) return;

    const style = getComputedStyle(document.body);
    const primaryColor = style.getPropertyValue("--primary").trim();

    baseCtx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
    const meta = computeMinimapMeta(grid, MINIMAP_SIZE, PADDING);
    if (!meta.valid) {
      ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
      viewMetaRef.current = null;
      viewportRectRef.current = null;
      return;
    }

    baseCtx.fillStyle = `oklch(from ${primaryColor} l c h / 0.3)`;
    grid.forEach((_, key) => {
      const [x, y] = key.split(",").map(Number);
      const px = (x - meta.minX) * meta.scale + PADDING;
      const py = (y - meta.minY) * meta.scale + PADDING;
      baseCtx.fillRect(
        px,
        py,
        Math.max(meta.scale * 0.8, 1),
        Math.max(meta.scale * 0.8, 1)
      );
    });
    viewMetaRef.current = meta;
  }, [grid, containerSize]);

  useEffect(() => {
    let rafId = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas || !containerSize) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
      if (!grid || grid.size === 0) {
        viewportRectRef.current = null;
        return;
      }

      const meta = viewMetaRef.current;
      if (!meta || !meta.valid) {
        viewportRectRef.current = null;
        return;
      }

      const baseCanvas = baseLayerRef.current;
      if (baseCanvas) ctx.drawImage(baseCanvas, 0, 0);

      const style = getComputedStyle(document.body);
      const mutedColor = style.getPropertyValue("--muted-foreground").trim();

      const viewport = clampViewportRect(
        computeViewportRect(offset, zoom, containerSize, meta, PADDING),
        MINIMAP_SIZE
      );
      viewportRectRef.current = viewport;

      ctx.strokeStyle = `oklch(from ${mutedColor} l c h / 0.8)`;
      ctx.lineWidth = 1;
      ctx.strokeRect(viewport.x, viewport.y, viewport.width, viewport.height);

      ctx.fillStyle = `oklch(from ${mutedColor} l c h / 0.1)`;
      ctx.fillRect(viewport.x, viewport.y, viewport.width, viewport.height);
    };

    rafId = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [grid, offset, zoom, containerSize]);

  const endViewportDrag = () => {
    dragStateRef.current = EMPTY_DRAG_STATE;
    setIsDraggingViewport(false);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    const point = getCanvasPoint(e);
    const viewport = viewportRectRef.current;
    if (!point || !viewport) return;

    if (!isPointInViewport(point, viewport, VIEWPORT_HIT_SLOP)) return;

    dragStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
      moved: false,
      viewportDrag: true,
    };

    canvasRef.current?.setPointerCapture(e.pointerId);
    setIsDraggingViewport(true);
    e.preventDefault();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    const dragState = dragStateRef.current;

    if (
      dragState.active &&
      dragState.viewportDrag &&
      dragState.pointerId === e.pointerId
    ) {
      const meta = viewMetaRef.current;
      if (!meta || !meta.valid) return;

      const deltaX = e.clientX - dragState.lastClientX;
      const deltaY = e.clientY - dragState.lastClientY;

      if (
        !dragState.moved &&
        (Math.abs(e.clientX - dragState.startClientX) > DRAG_THRESHOLD ||
          Math.abs(e.clientY - dragState.startClientY) > DRAG_THRESHOLD)
      ) {
        dragState.moved = true;
      }

      dragState.lastClientX = e.clientX;
      dragState.lastClientY = e.clientY;

      const dxGrid = deltaX / meta.scale;
      const dyGrid = deltaY / meta.scale;

      setOffset((prev) => ({
        x: prev.x - dxGrid * DEFAULT_GRID_RENDER_METRICS.cellWidth * zoom,
        y: prev.y - dyGrid * DEFAULT_GRID_RENDER_METRICS.cellHeight * zoom,
      }));
      e.preventDefault();
      return;
    }

    const point = getCanvasPoint(e);
    const viewport = viewportRectRef.current;
    if (!point || !viewport || isDraggingViewport) {
      setIsViewportHovered(false);
      return;
    }

    setIsViewportHovered(isPointInViewport(point, viewport, VIEWPORT_HIT_SLOP));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    const dragState = dragStateRef.current;
    if (
      !dragState.active ||
      !dragState.viewportDrag ||
      dragState.pointerId !== e.pointerId
    ) {
      return;
    }

    if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
      canvasRef.current.releasePointerCapture(e.pointerId);
    }

    endViewportDrag();
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
      canvasRef.current.releasePointerCapture(e.pointerId);
    }
    endViewportDrag();
  };

  const handlePointerLeave = () => {
    if (!dragStateRef.current.active) {
      setIsViewportHovered(false);
    }
  };

  const handleMinimapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    if (suppressClickRef.current) return;
    if ((!grid || grid.size === 0) || !containerSize) {
      return;
    }
    const meta = viewMetaRef.current;
    if (!meta || !meta.valid) return;

    const point = getCanvasPoint(e);
    if (!point) return;
    const target = minimapPointToGrid(point, meta, PADDING);

    const newOffsetX =
      containerSize.width / 2 - target.x * DEFAULT_GRID_RENDER_METRICS.cellWidth * zoom;
    const newOffsetY =
      containerSize.height / 2 - target.y * DEFAULT_GRID_RENDER_METRICS.cellHeight * zoom;

    setOffset(() => ({ x: newOffsetX, y: newOffsetY }));
  };

  const cursorClass = isDraggingViewport
    ? "cursor-grabbing"
    : isViewportHovered
    ? "cursor-grab"
    : "cursor-crosshair";

  return (
    <div
      data-minimap-root="true"
      className={cn(uiClass.minimapShell, cursorClass)}
    >
      <canvas
        ref={canvasRef}
        width={MINIMAP_SIZE}
        height={MINIMAP_SIZE}
        aria-label="Canvas minimap"
        className={uiClass.minimapCanvas}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
        onClick={handleMinimapClick}
      />
    </div>
  );
};
