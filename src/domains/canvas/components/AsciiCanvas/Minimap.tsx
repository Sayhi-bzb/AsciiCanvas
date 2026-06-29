"use client";

import { Map, PanelLeftClose } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { cn } from "@/shared/lib/utils";
import { uiClass } from "@/shared/styles/components";
import { DEFAULT_GRID_RENDER_METRICS } from "@/shared/metrics";
import { Button } from "@/shared/ui/button";
import {
  clampViewportRect,
  computeMinimapMeta,
  computeViewportRect,
  isPointInViewport,
  minimapPointToGrid,
} from "./minimap/geometry";
import type { MinimapMeta, ViewportRect } from "./minimap/types";
import { useShallow } from "zustand/react/shallow";

const MINIMAP_SIZE = 220;
const PADDING = 8;
const VIEWPORT_HIT_SLOP = 4;
const DRAG_THRESHOLD = 3;
const MIN_CONTENT_PIXEL_SIZE = 2;
const AUTO_COLLAPSE_WIDTH = 900;
const AUTO_COLLAPSE_HEIGHT = 640;

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
  const [isExpanded, setIsExpanded] = useState(false);
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

  const configureCanvasScale = (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
  ) => {
    const pixelRatio = Math.max(window.devicePixelRatio || 1, 1);
    const backingSize = Math.round(MINIMAP_SIZE * pixelRatio);
    if (canvas.width !== backingSize) canvas.width = backingSize;
    if (canvas.height !== backingSize) canvas.height = backingSize;
    canvas.style.width = `${MINIMAP_SIZE}px`;
    canvas.style.height = `${MINIMAP_SIZE}px`;
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
    if (!isExpanded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    configureCanvasScale(canvas, ctx);

    if ((!grid || grid.size === 0) || !containerSize) {
      ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
      viewMetaRef.current = null;
      viewportRectRef.current = null;
      return;
    }

    const baseCanvas =
      baseLayerRef.current || document.createElement("canvas");
    baseLayerRef.current = baseCanvas;
    const baseCtx = baseCanvas.getContext("2d");
    if (!baseCtx) return;
    configureCanvasScale(baseCanvas, baseCtx);

    const meta = computeMinimapMeta(grid, MINIMAP_SIZE, PADDING);
    if (!meta.valid) {
      ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
      viewMetaRef.current = null;
      viewportRectRef.current = null;
      return;
    }

    const backgroundColor = getCssColor("--background");
    const borderColor = getCssColor("--border");
    baseCtx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
    baseCtx.fillStyle = backgroundColor || "transparent";
    baseCtx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
    baseCtx.strokeStyle = `oklch(from ${borderColor} l c h / 0.55)`;
    baseCtx.lineWidth = 1;
    baseCtx.strokeRect(
      PADDING - 0.5,
      PADDING - 0.5,
      meta.contentWidth * meta.scale + 1,
      meta.contentHeight * meta.scale + 1
    );

    const pixelSize = Math.max(meta.scale * 0.9, MIN_CONTENT_PIXEL_SIZE);
    grid.forEach((cell, key) => {
      if (!hasVisibleMinimapContent(cell)) return;
      const [x, y] = key.split(",").map(Number);
      const px = (x - meta.minX) * meta.scale + PADDING;
      const py = (y - meta.minY) * meta.scale + PADDING;
      baseCtx.fillStyle = getCellPreviewColor(cell);
      baseCtx.fillRect(px, py, pixelSize, pixelSize);
    });
    viewMetaRef.current = meta;
  }, [grid, containerSize, isExpanded, getCellPreviewColor, getCssColor]);

  useEffect(() => {
    let rafId = 0;
    const draw = () => {
      if (!isExpanded) return;
      const canvas = canvasRef.current;
      if (!canvas || !containerSize) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      configureCanvasScale(canvas, ctx);

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
      if (baseCanvas) ctx.drawImage(baseCanvas, 0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

      const mutedColor = getCssColor("--muted-foreground");
      const primaryColor = getCssColor("--primary");

      const viewport = clampViewportRect(
        computeViewportRect(offset, zoom, containerSize, meta, PADDING),
        MINIMAP_SIZE
      );
      viewportRectRef.current = viewport;

      ctx.fillStyle = `oklch(from ${mutedColor} l c h / 0.12)`;
      ctx.fillRect(viewport.x, viewport.y, viewport.width, viewport.height);

      ctx.strokeStyle = `oklch(from ${mutedColor} l c h / 0.9)`;
      ctx.lineWidth = 3;
      ctx.strokeRect(viewport.x, viewport.y, viewport.width, viewport.height);

      ctx.strokeStyle = primaryColor || mutedColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(
        viewport.x + 1.5,
        viewport.y + 1.5,
        Math.max(viewport.width - 3, 1),
        Math.max(viewport.height - 3, 1)
      );
    };

    rafId = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [grid, offset, zoom, containerSize, isExpanded, getCssColor]);

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

  const isAutoCollapsed =
    !containerSize ||
    containerSize.width < AUTO_COLLAPSE_WIDTH ||
    containerSize.height < AUTO_COLLAPSE_HEIGHT;
  const isPanelExpanded = isExpanded && !isAutoCollapsed;

  const cursorClass = isDraggingViewport
    ? "cursor-grabbing"
    : isViewportHovered
    ? "cursor-grab"
    : "cursor-crosshair";

  return (
    <div data-minimap-root="true" className={uiClass.minimapShell}>
      {!isPanelExpanded ? (
        <Button
          type="button"
          tone="subtle"
          shape="square"
          size="md"
          aria-label="Open overview panel"
          title="Overview"
          className={uiClass.minimapToggle}
          data-testid="overview-panel-toggle"
          onClick={(event) => {
            event.stopPropagation();
            if (!isAutoCollapsed) setIsExpanded(true);
          }}
        >
          <Map className="size-4" />
        </Button>
      ) : (
        <div
          className={cn(uiClass.minimapPanel, cursorClass)}
          data-testid="overview-panel"
        >
          <div className={uiClass.minimapHeader}>
            <div className="min-w-0 leading-none">
              <div className="font-medium text-foreground">Overview</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {grid?.size ?? 0} cells - {Math.round(zoom * 100)}%
              </div>
            </div>
            <Button
              type="button"
              tone="subtle"
              shape="square"
              size="sm"
              aria-label="Collapse overview panel"
              className="size-7 shrink-0 text-muted-foreground"
              onClick={(event) => {
                event.stopPropagation();
                setIsExpanded(false);
                setIsViewportHovered(false);
                endViewportDrag();
              }}
            >
              <PanelLeftClose className="size-4" />
            </Button>
          </div>
          <div className={uiClass.minimapCanvasWrap}>
            <canvas
              ref={canvasRef}
              width={MINIMAP_SIZE}
              height={MINIMAP_SIZE}
              aria-label="Canvas overview"
              className={uiClass.minimapCanvas}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onPointerLeave={handlePointerLeave}
              onClick={handleMinimapClick}
            />
          </div>
        </div>
      )}
    </div>
  );
};

