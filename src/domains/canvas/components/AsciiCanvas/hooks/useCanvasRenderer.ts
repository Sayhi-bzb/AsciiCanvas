import { useEffect } from "react";
import {
  BACKGROUND_COLOR,
  CELL_HEIGHT,
  CELL_WIDTH,
  COLOR_ORIGIN_MARKER,
  COLOR_SELECTION_BG,
  COLOR_TEXT_CURSOR_BG,
  COLOR_TEXT_CURSOR_FG,
  FONT_SIZE,
  GRID_COLOR,
} from "@/shared/lib/constants";
import type { CanvasState } from "@/domains/canvas/state/canvasStore";
import { GridManager } from "@/shared/utils/grid";
import type { SelectionArea, GridMap, Point } from "@/shared/types";
import { getSelectionBounds } from "@/shared/utils/selection";
import { createMapFromEntries } from "@/domains/canvas/state/helpers/snapshotHelpers";
import { getAnimationFrameIndex } from "@/domains/canvas/state/helpers/animationHelpers";

interface LayerRefs {
  bg: React.RefObject<HTMLCanvasElement | null>;
  scratch: React.RefObject<HTMLCanvasElement | null>;
  ui: React.RefObject<HTMLCanvasElement | null>;
}

export const useCanvasRenderer = (
  layers: LayerRefs,
  size: { width: number; height: number } | undefined,
  store: Pick<
    CanvasState,
    | "offset"
    | "zoom"
    | "grid"
    | "scratchLayer"
    | "textCursor"
    | "selections"
    | "showGrid"
    | "hoveredGrid"
    | "tool"
    | "canvasMode"
    | "canvasBounds"
    | "animationTimeline"
  >,
  draggingSelection: SelectionArea | null
) => {
  const {
    offset,
    zoom,
    grid,
    scratchLayer,
    textCursor,
    selections,
    showGrid,
    hoveredGrid,
    tool,
    canvasMode,
    canvasBounds,
    animationTimeline,
  } = store;

  const traceRoundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) => {
    const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, safeRadius);
  };

  const prepareCanvas = (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dpr: number
  ) => {
    const targetWidth = Math.floor(width * dpr);
    const targetHeight = Math.floor(height * dpr);
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, targetWidth, targetHeight);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const drawLayer = (
    ctx: CanvasRenderingContext2D,
    targetGrid: GridMap | null,
    viewBounds: ReturnType<typeof GridManager.getViewportGridBounds>,
    zoom: number,
    offset: Point,
    alpha = 1
  ) => {
    if (!targetGrid || targetGrid.size === 0) return;

    const sw = CELL_WIDTH * zoom;
    const sh = CELL_HEIGHT * zoom;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${FONT_SIZE * zoom}px 'Maple Mono NF CN', monospace`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    for (let y = viewBounds.startY; y <= viewBounds.endY; y++) {
      for (let x = viewBounds.startX; x <= viewBounds.endX; x++) {
        const cell = targetGrid.get(GridManager.toKey(x, y));
        if (!cell || cell.char === " ") continue;

        const pos = GridManager.gridToScreen(x, y, offset.x, offset.y, zoom);
        const wide = GridManager.isWideChar(cell.char);
        ctx.fillStyle = cell.color;
        ctx.fillText(
          cell.char,
          Math.round(pos.x + (wide ? sw : sw / 2)),
          Math.round(pos.y + sh / 2)
        );
      }
    }
    ctx.restore();
  };

  useEffect(() => {
    const getAnimationGhostLayers = () => {
      if (
        canvasMode !== "animation" ||
        !animationTimeline ||
        !animationTimeline.onionSkin.enabled
      ) {
        return [];
      }

      const currentIndex = getAnimationFrameIndex(
        animationTimeline,
        animationTimeline.currentFrameId
      );
      if (currentIndex === -1) return [];

      const { backwardLayers, forwardLayers, opacityFalloff } =
        animationTimeline.onionSkin;
      const layers: Array<{ grid: GridMap; alpha: number }> = [];

      for (let i = backwardLayers; i >= 1; i--) {
        const frame = animationTimeline.frames[currentIndex - i];
        const alpha = opacityFalloff[i - 1] ?? 0;
        if (!frame || alpha <= 0) continue;
        layers.push({
          grid: createMapFromEntries(frame.grid),
          alpha,
        });
      }

      for (let i = 1; i <= forwardLayers; i++) {
        const frame = animationTimeline.frames[currentIndex + i];
        const alpha = opacityFalloff[i - 1] ?? 0;
        if (!frame || alpha <= 0) continue;
        layers.push({
          grid: createMapFromEntries(frame.grid),
          alpha,
        });
      }

      return layers;
    };

    const render = () => {
      if (!size || size.width === 0 || size.height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      const sw = CELL_WIDTH * zoom;
      const sh = CELL_HEIGHT * zoom;
      const viewBounds = GridManager.getViewportGridBounds(
        size.width,
        size.height,
        offset.x,
        offset.y,
        zoom
      );
      const boundedView =
        canvasMode === "animation" && canvasBounds
          ? {
              startX: Math.max(0, viewBounds.startX),
              endX: Math.min(canvasBounds.width - 1, viewBounds.endX),
              startY: Math.max(0, viewBounds.startY),
              endY: Math.min(canvasBounds.height - 1, viewBounds.endY),
            }
          : viewBounds;
      const animationViewportRect =
        canvasMode === "animation" && canvasBounds
          ? {
              x: offset.x,
              y: offset.y,
              width: canvasBounds.width * sw,
              height: canvasBounds.height * sh,
            }
          : null;
      const animationGhostLayers = getAnimationGhostLayers();

      const bgCanvas = layers.bg.current;
      const bgCtx = bgCanvas?.getContext("2d", { alpha: false });
      if (bgCanvas && bgCtx) {
        prepareCanvas(bgCanvas, bgCtx, size.width, size.height, dpr);
        bgCtx.fillStyle = BACKGROUND_COLOR;
        bgCtx.fillRect(0, 0, size.width, size.height);

        if (animationViewportRect) {
          const borderRadius = Math.min(16, sw * 0.45, sh * 0.45);
          bgCtx.save();
          traceRoundRect(
            bgCtx,
            Math.round(animationViewportRect.x),
            Math.round(animationViewportRect.y),
            Math.round(animationViewportRect.width),
            Math.round(animationViewportRect.height),
            borderRadius
          );
          bgCtx.clip();
        }

        if (showGrid) {
          bgCtx.beginPath();
          bgCtx.strokeStyle = GRID_COLOR;
          bgCtx.lineWidth = 1;
          const gridStartX =
            canvasMode === "animation" && canvasBounds
              ? Math.max(0, boundedView.startX)
              : viewBounds.startX;
          const gridEndX =
            canvasMode === "animation" && canvasBounds
              ? Math.min(canvasBounds.width, boundedView.endX + 1)
              : viewBounds.endX;
          const gridStartY =
            canvasMode === "animation" && canvasBounds
              ? Math.max(0, boundedView.startY)
              : viewBounds.startY;
          const gridEndY =
            canvasMode === "animation" && canvasBounds
              ? Math.min(canvasBounds.height, boundedView.endY + 1)
              : viewBounds.endY;
          for (let x = gridStartX; x <= gridEndX; x++) {
            const posX = Math.round(x * sw + offset.x);
            bgCtx.moveTo(posX, 0);
            bgCtx.lineTo(posX, size.height);
          }
          for (let y = gridStartY; y <= gridEndY; y++) {
            const posY = Math.round(y * sh + offset.y);
            bgCtx.moveTo(0, posY);
            bgCtx.lineTo(size.width, posY);
          }
          bgCtx.stroke();
        }
        animationGhostLayers.forEach((layer) => {
          drawLayer(bgCtx, layer.grid, boundedView, zoom, offset, layer.alpha);
        });
        drawLayer(
          bgCtx,
          grid,
          canvasMode === "animation" ? boundedView : viewBounds,
          zoom,
          offset
        );

        if (animationViewportRect) {
          bgCtx.restore();
        }

        if (canvasMode === "animation" && canvasBounds) {
          const borderPos = GridManager.gridToScreen(0, 0, offset.x, offset.y, zoom);
          const borderRadius = Math.min(16, sw * 0.45, sh * 0.45);
          bgCtx.strokeStyle = "#000000";
          bgCtx.lineWidth = 2;
          traceRoundRect(
            bgCtx,
            Math.round(borderPos.x),
            Math.round(borderPos.y),
            Math.round(canvasBounds.width * sw),
            Math.round(canvasBounds.height * sh),
            borderRadius
          );
          bgCtx.stroke();
        }
      }

      const scratchCanvas = layers.scratch.current;
      const scratchCtx = scratchCanvas?.getContext("2d");
      if (scratchCanvas && scratchCtx) {
        prepareCanvas(scratchCanvas, scratchCtx, size.width, size.height, dpr);
        drawLayer(
          scratchCtx,
          scratchLayer,
          canvasMode === "animation" ? boundedView : viewBounds,
          zoom,
          offset
        );
      }

      const uiCanvas = layers.ui.current;
      const uiCtx = uiCanvas?.getContext("2d");
      if (uiCanvas && uiCtx) {
        prepareCanvas(uiCanvas, uiCtx, size.width, size.height, dpr);

        const drawSel = (area: SelectionArea) => {
          const { minX, minY, maxX, maxY } = getSelectionBounds(area);
          const pos = GridManager.gridToScreen(
            minX,
            minY,
            offset.x,
            offset.y,
            zoom
          );
          uiCtx.fillStyle = COLOR_SELECTION_BG;
          uiCtx.fillRect(
            Math.round(pos.x),
            Math.round(pos.y),
            Math.round((maxX - minX + 1) * sw),
            Math.round((maxY - minY + 1) * sh)
          );
        };
        selections.forEach(drawSel);
        if (draggingSelection) drawSel(draggingSelection);

        if (tool === "eraser" && hoveredGrid) {
          const pos = GridManager.gridToScreen(
            hoveredGrid.x,
            hoveredGrid.y,
            offset.x,
            offset.y,
            zoom
          );
          uiCtx.fillStyle = "rgba(239, 68, 68, 0.3)";
          uiCtx.fillRect(
            Math.round(pos.x),
            Math.round(pos.y),
            Math.round(sw),
            Math.round(sh)
          );
        }

        if (textCursor) {
          const pos = GridManager.gridToScreen(
            textCursor.x,
            textCursor.y,
            offset.x,
            offset.y,
            zoom
          );
          const cell = grid.get(GridManager.toKey(textCursor.x, textCursor.y));
          const wide = cell ? GridManager.isWideChar(cell.char) : false;
          uiCtx.fillStyle = COLOR_TEXT_CURSOR_BG;
          uiCtx.fillRect(
            Math.round(pos.x),
            Math.round(pos.y),
            Math.round(wide ? sw * 2 : sw),
            Math.round(sh)
          );
          if (cell) {
            uiCtx.font = `${FONT_SIZE * zoom}px 'Maple Mono NF CN', monospace`;
            uiCtx.textAlign = "center";
            uiCtx.textBaseline = "middle";
            uiCtx.fillStyle = COLOR_TEXT_CURSOR_FG;
            uiCtx.fillText(
              cell.char,
              Math.round(pos.x + (wide ? sw : sw / 2)),
              Math.round(pos.y + sh / 2)
            );
          }
        }

        if (canvasMode !== "animation") {
          uiCtx.fillStyle = COLOR_ORIGIN_MARKER;
          const originX = Math.round(offset.x);
          const originY = Math.round(offset.y);
          uiCtx.fillRect(originX - 1, originY - 10, 2, 20);
          uiCtx.fillRect(originX - 10, originY - 1, 20, 2);
        }
      }
    };

    const requestId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(requestId);
  }, [
    offset,
    zoom,
    size,
    grid,
    scratchLayer,
    textCursor,
    selections,
    draggingSelection,
    showGrid,
    hoveredGrid,
    tool,
    canvasMode,
    canvasBounds,
    animationTimeline,
    layers,
  ]);
};
