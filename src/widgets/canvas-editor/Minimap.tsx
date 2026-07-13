"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "@/domains/canvas/public";
import { cn } from "@/shared/lib/utils";
import { DEFAULT_GRID_RENDER_METRICS } from "@/shared/metrics";
import { GridManager } from "@/shared/utils/grid";
import {
  computeMinimapMeta,
  computeMinimapDimensions,
  computeViewportRect,
  intersectViewportRect,
  isPointInViewport,
  minimapPointToGrid,
} from "./minimap/geometry";
import type {
  MinimapDimensions,
  MinimapMeta,
  ViewportRect,
} from "./minimap/types";
import { useShallow } from "zustand/react/shallow";

const MINIMAP_MAX_SIZE = 220;
const MINIMAP_MIN_SIZE = 96;
const PADDING = 4;
const VIEWPORT_HIT_SLOP = 4;
const DRAG_THRESHOLD = 3;
const MIN_CONTENT_PIXEL_SIZE = 1;

type MinimapCell = {
  char?: string;
  color?: string;
  bgColor?: string;
};

const hasVisibleMinimapContent = (cell: MinimapCell) => {
  if (cell.bgColor && cell.bgColor !== "transparent") return true;
  return !!cell.char && cell.char !== " ";
};

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
  const { grid, offset, zoom, setOffset } = useEditorStore(
    useShallow((state) => ({
      grid: state.grid,
      offset: state.offset,
      zoom: state.zoom,
      setOffset: state.setOffset,
    }))
  );
  const minimapDimensions = useMemo(
    () =>
      computeMinimapDimensions(
        grid,
        MINIMAP_MAX_SIZE,
        MINIMAP_MIN_SIZE,
        PADDING
      ),
    [grid]
  );

  const configureCanvasScale = (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    dimensions: MinimapDimensions
  ) => {
    const pixelRatio = Math.max(window.devicePixelRatio || 1, 1);
    const backingWidth = Math.round(dimensions.width * pixelRatio);
    const backingHeight = Math.round(dimensions.height * pixelRatio);
    if (canvas.width !== backingWidth) canvas.width = backingWidth;
    if (canvas.height !== backingHeight) canvas.height = backingHeight;
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingEnabled = false;
    return pixelRatio;
  };

  const getCssColor = useCallback(
    (name: string) => getComputedStyle(document.body).getPropertyValue(name).trim(),
    []
  );

  const getCellPreviewColor = useCallback(
    (cell: MinimapCell) => {
      if (cell.bgColor && cell.bgColor !== "transparent") return cell.bgColor;
      return cell.color || getCssColor("--foreground") || "currentColor";
    },
    [getCssColor]
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
    configureCanvasScale(canvas, ctx, minimapDimensions);

    if ((!grid || grid.size === 0) || !containerSize) {
      ctx.clearRect(0, 0, minimapDimensions.width, minimapDimensions.height);
      viewMetaRef.current = null;
      viewportRectRef.current = null;
      return;
    }

    const baseCanvas =
      baseLayerRef.current || document.createElement("canvas");
    baseLayerRef.current = baseCanvas;
    const baseCtx = baseCanvas.getContext("2d");
    if (!baseCtx) return;
    configureCanvasScale(baseCanvas, baseCtx, minimapDimensions);

    const meta = computeMinimapMeta(grid, minimapDimensions, PADDING);
    if (!meta.valid) {
      ctx.clearRect(0, 0, minimapDimensions.width, minimapDimensions.height);
      viewMetaRef.current = null;
      viewportRectRef.current = null;
      return;
    }

    const backgroundColor = getCssColor("--background");
    baseCtx.clearRect(0, 0, minimapDimensions.width, minimapDimensions.height);
    baseCtx.fillStyle = backgroundColor || "transparent";
    baseCtx.fillRect(0, 0, minimapDimensions.width, minimapDimensions.height);

    const { cellWidth, cellHeight } = DEFAULT_GRID_RENDER_METRICS;
    grid.forEach((cell, key) => {
      if (!hasVisibleMinimapContent(cell)) return;
      const [x, y] = key.split(",").map(Number);
      const occupancy = Math.max(GridManager.getCharWidth(cell.char ?? ""), 1);
      const px =
        meta.originX + (x - meta.minX) * cellWidth * meta.scale;
      const py =
        meta.originY + (y - meta.minY) * cellHeight * meta.scale;
      const pixelWidth = Math.max(
        occupancy * cellWidth * meta.scale * 0.9,
        MIN_CONTENT_PIXEL_SIZE
      );
      const pixelHeight = Math.max(
        cellHeight * meta.scale * 0.9,
        MIN_CONTENT_PIXEL_SIZE
      );
      baseCtx.fillStyle = getCellPreviewColor(cell);
      baseCtx.fillRect(px, py, pixelWidth, pixelHeight);
    });
    viewMetaRef.current = meta;
  }, [
    grid,
    containerSize,
    minimapDimensions,
    getCellPreviewColor,
    getCssColor,
  ]);

  useEffect(() => {
    let rafId = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas || !containerSize) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      configureCanvasScale(canvas, ctx, minimapDimensions);

      ctx.clearRect(0, 0, minimapDimensions.width, minimapDimensions.height);
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
      if (baseCanvas) {
        ctx.drawImage(
          baseCanvas,
          0,
          0,
          minimapDimensions.width,
          minimapDimensions.height
        );
      }

      const mutedColor = getCssColor("--muted-foreground");
      const primaryColor = getCssColor("--primary");

      const viewport = intersectViewportRect(
        computeViewportRect(offset, zoom, containerSize, meta),
        meta.contentRect
      );
      viewportRectRef.current = viewport;
      if (!viewport) return;

      ctx.fillStyle = `oklch(from ${mutedColor} l c h / 0.12)`;
      ctx.fillRect(viewport.x, viewport.y, viewport.width, viewport.height);

      ctx.strokeStyle = primaryColor || mutedColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(viewport.x, viewport.y, viewport.width, viewport.height);
    };

    rafId = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [
    grid,
    offset,
    zoom,
    containerSize,
    minimapDimensions,
    getCssColor,
  ]);

  const endViewportDrag = useCallback(() => {
    dragStateRef.current = EMPTY_DRAG_STATE;
    setIsDraggingViewport(false);
  }, []);

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

      const dxCanvas = deltaX / meta.scale;
      const dyCanvas = deltaY / meta.scale;

      setOffset((prev) => ({
        x: prev.x - dxCanvas * zoom,
        y: prev.y - dyCanvas * zoom,
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
    const target = minimapPointToGrid(point, meta);

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
    <canvas
      ref={canvasRef}
      width={minimapDimensions.width}
      height={minimapDimensions.height}
      style={{
        width: `${minimapDimensions.width}px`,
        height: `${minimapDimensions.height}px`,
      }}
      aria-label="Canvas minimap"
      data-testid="minimap-canvas"
      data-minimap-root="true"
      className={cn("block select-none", cursorClass)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      onClick={handleMinimapClick}
    />
  );
};

