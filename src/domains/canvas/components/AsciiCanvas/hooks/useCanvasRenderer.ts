import { useEffect } from "react";
import {
  BACKGROUND_COLOR,
  COLOR_ORIGIN_MARKER,
  COLOR_SELECTION_BG,
  COLOR_TEXT_CURSOR_BG,
  COLOR_TEXT_CURSOR_FG,
  GRID_COLOR,
} from "@/shared/lib/constants";
import type { CanvasState } from "@/domains/canvas/state/canvasStore";
import { GridManager } from "@/shared/utils/grid";
import type { SelectionArea, GridMap, Point, NodeBounds } from "@/shared/types";
import type { CanvasLinkHit } from "./linkHitTesting";
import { getSelectionBounds } from "@/shared/utils/selection";
import { createMapFromEntries } from "@/domains/canvas/state/helpers/snapshotHelpers";
import { getAnimationFrameIndex } from "@/domains/canvas/state/helpers/animationHelpers";
import {
  DEFAULT_GRID_RENDER_METRICS,
  drawGridLines,
  drawTextCell,
  getCellOccupancy,
  getCellPixelSize,
  gridCellRect,
  prepareCanvasSurface,
  setTextRenderStyle,
  splitGraphemes,
} from "@/shared/metrics";
import { effectiveCellStyle } from "@/shared/utils/ansi";
import { getStaticGridViewState } from "@/domains/canvas/state/helpers/staticGridModel";
import { getStructuredBoxBounds } from "@/domains/canvas/state/helpers/structuredBoxEditing";
import { getStructuredNodeBounds } from "@/shared/utils/structured";
import { getStructuredTextSelectionRange } from "@/shared/utils/structuredTextRanges";

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
    | "staticGridSelection"
    | "staticGridEditMode"
    | "showGrid"
    | "hoveredGrid"
    | "tool"
    | "canvasMode"
    | "canvasBounds"
    | "animationTimeline"
    | "selectedStructuredNodeIds"
    | "selectedStructuredBoxId"
    | "structuredGridFocus"
    | "structuredScene"
    | "editingStructuredTextNodeId"
    | "structuredTextSelection"
  >,
  draggingSelection: SelectionArea | null,
  hoveredLink: CanvasLinkHit | null
) => {
  const {
    offset,
    zoom,
    grid,
    scratchLayer,
    textCursor,
    selections,
    staticGridSelection,
    staticGridEditMode,
    showGrid,
    hoveredGrid,
    tool,
    canvasMode,
    canvasBounds,
    animationTimeline,
    selectedStructuredNodeIds,
    selectedStructuredBoxId,
    structuredGridFocus,
    structuredScene,
    editingStructuredTextNodeId,
    structuredTextSelection,
  } = store;

  const staticGridView = getStaticGridViewState({
    selection: staticGridSelection,
    editMode: staticGridEditMode,
    textCursor,
    selections,
  });
  const renderedSelections =
    canvasMode === "freeform" ? staticGridView.selectionAreas : selections;
  const renderedTextCursor =
    canvasMode === "freeform" ? staticGridView.textCursor : textCursor;
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

  const drawLayer = (
    ctx: CanvasRenderingContext2D,
    targetGrid: GridMap | null,
    viewBounds: ReturnType<typeof GridManager.getViewportGridBounds>,
    zoom: number,
    offset: Point,
    alpha = 1
  ) => {
    if (!targetGrid || targetGrid.size === 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    setTextRenderStyle(ctx, zoom);

    for (let y = viewBounds.startY; y <= viewBounds.endY; y++) {
      for (let x = viewBounds.startX; x <= viewBounds.endX; x++) {
        const cell = targetGrid.get(GridManager.toKey(x, y));
        if (!cell) continue;
        const style = effectiveCellStyle(cell);
        if (cell.char === " " && !style.bgColor && !style.attrs) continue;

        const pos = GridManager.gridToScreen(x, y, offset.x, offset.y, zoom);
        drawTextCell(ctx, cell, pos.x, pos.y, {
          zoom,
          underline:
            !!cell.href &&
            hoveredLink?.href === cell.href &&
            hoveredLink.y === y &&
            x >= hoveredLink.startX &&
            x <= hoveredLink.endX,
        });
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
      const { width: sw, height: sh } = getCellPixelSize(zoom);
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
        prepareCanvasSurface(bgCanvas, bgCtx, size.width, size.height, dpr);
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
          drawGridLines(bgCtx, {
            startX: gridStartX,
            endX: gridEndX,
            startY: gridStartY,
            endY: gridEndY,
            offsetX: offset.x,
            offsetY: offset.y,
            width: size.width,
            height: size.height,
            zoom,
            color: GRID_COLOR,
          });
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
        prepareCanvasSurface(scratchCanvas, scratchCtx, size.width, size.height, dpr);
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
        prepareCanvasSurface(uiCanvas, uiCtx, size.width, size.height, dpr);

        const drawSel = (area: SelectionArea) => {
          const { minX, minY, maxX, maxY } = getSelectionBounds(area);
          const pos = gridCellRect({ x: minX, y: minY }, { offset, zoom });
          uiCtx.fillStyle = COLOR_SELECTION_BG;
          uiCtx.fillRect(
            Math.round(pos.x),
            Math.round(pos.y),
            Math.round((maxX - minX + 1) * pos.width),
            Math.round((maxY - minY + 1) * pos.height)
          );
        };
        renderedSelections.forEach(drawSel);
        if (draggingSelection) drawSel(draggingSelection);

        const drawActiveCellFocus = (point: Point) => {
          const pos = gridCellRect(point, { offset, zoom });
          uiCtx.save();
          uiCtx.fillStyle = "rgba(37, 99, 235, 0.12)";
          uiCtx.strokeStyle = "#2563eb";
          uiCtx.lineWidth = Math.max(1, Math.round(1.5 * zoom));
          uiCtx.fillRect(
            Math.round(pos.x),
            Math.round(pos.y),
            Math.round(pos.width),
            Math.round(pos.height)
          );
          uiCtx.strokeRect(
            Math.round(pos.x),
            Math.round(pos.y),
            Math.round(pos.width),
            Math.round(pos.height)
          );
          uiCtx.restore();
        };

        if (canvasMode === "structured") {
          if (
            structuredGridFocus &&
            !editingStructuredTextNodeId &&
            selectedStructuredNodeIds.length === 0
          ) {
            drawActiveCellFocus(structuredGridFocus);
          }

          const selectionRange = getStructuredTextSelectionRange(
            structuredTextSelection
          );
          const selectedTextNode =
            selectionRange && structuredTextSelection
              ? structuredScene.find(
                  (node) =>
                    node.id === structuredTextSelection.nodeId &&
                    node.type === "text"
                )
              : null;
          if (selectedTextNode?.type === "text") {
            let currentX = selectedTextNode.position.x;
            let currentY = selectedTextNode.position.y;
            splitGraphemes(selectedTextNode.text).forEach((char, index) => {
              if (char === "\n") {
                currentX = selectedTextNode.position.x;
                currentY += 1;
                return;
              }
              const occupancy = getCellOccupancy(char);
              if (index >= selectionRange!.start && index < selectionRange!.end) {
                const pos = gridCellRect(
                  { x: currentX, y: currentY },
                  { offset, zoom }
                );
                uiCtx.fillStyle = COLOR_SELECTION_BG;
                uiCtx.fillRect(
                  Math.round(pos.x),
                  Math.round(pos.y),
                  Math.round(pos.width * occupancy),
                  Math.round(pos.height)
                );
              }
              currentX += occupancy;
            });
          }
        }

        if (canvasMode === "structured" && selectedStructuredNodeIds.length > 0) {
          const selectedIds = new Set(selectedStructuredNodeIds);
          const selectedNodes = structuredScene.filter(
            (node) =>
              selectedIds.has(node.id) &&
              !(
                editingStructuredTextNodeId &&
                node.id === editingStructuredTextNodeId &&
                node.type === "text"
              )
          );
          const drawStructuredBounds = (bounds: NodeBounds) => {
            const pos = gridCellRect({ x: bounds.x, y: bounds.y }, { offset, zoom });
            const width = bounds.width * pos.width;
            const height = bounds.height * pos.height;
            uiCtx.strokeRect(
              Math.round(pos.x),
              Math.round(pos.y),
              Math.round(width),
              Math.round(height)
            );
            return { pos, width, height };
          };

          uiCtx.save();
          uiCtx.strokeStyle = "#2563eb";
          uiCtx.lineWidth = Math.max(1, Math.round(2 * zoom));
          selectedNodes.forEach((node) => drawStructuredBounds(getStructuredNodeBounds(node)));

          const selectedBox =
            selectedStructuredNodeIds.length === 1
              ? structuredScene.find((node) => node.id === selectedStructuredBoxId && node.type === "box")
              : null;
          if (selectedBox?.type === "box") {
            const bounds = getStructuredBoxBounds(selectedBox);
            const { pos, width, height } = drawStructuredBounds(bounds);
            uiCtx.fillStyle = "#ffffff";
            uiCtx.strokeStyle = "#2563eb";
            uiCtx.lineWidth = 1;
            const handleSize = Math.max(6, Math.round(7 * zoom));
            const points = [
              [pos.x, pos.y],
              [pos.x + width / 2, pos.y],
              [pos.x + width, pos.y],
              [pos.x + width, pos.y + height / 2],
              [pos.x + width, pos.y + height],
              [pos.x + width / 2, pos.y + height],
              [pos.x, pos.y + height],
              [pos.x, pos.y + height / 2],
            ];
            points.forEach(([px, py]) => {
              uiCtx.fillRect(Math.round(px - handleSize / 2), Math.round(py - handleSize / 2), handleSize, handleSize);
              uiCtx.strokeRect(Math.round(px - handleSize / 2), Math.round(py - handleSize / 2), handleSize, handleSize);
            });
          }
          uiCtx.restore();
        }

        if (tool === "eraser" && hoveredGrid) {
          const pos = gridCellRect(hoveredGrid, { offset, zoom });
          uiCtx.fillStyle = "rgba(239, 68, 68, 0.3)";
          uiCtx.fillRect(
            Math.round(pos.x),
            Math.round(pos.y),
            Math.round(pos.width),
            Math.round(pos.height)
          );
        }

        if (renderedTextCursor) {
          const pos = gridCellRect(renderedTextCursor, { offset, zoom });
          if (canvasMode === "freeform") {
            drawActiveCellFocus(renderedTextCursor);
          } else if (canvasMode === "structured" && editingStructuredTextNodeId) {
            uiCtx.fillStyle = COLOR_TEXT_CURSOR_BG;
            uiCtx.fillRect(
              Math.round(pos.x),
              Math.round(pos.y),
              Math.max(1, Math.round(2 * zoom)),
              Math.round(pos.height)
            );
          } else {
            const cell = grid.get(GridManager.toKey(renderedTextCursor.x, renderedTextCursor.y));
            const occupancy = cell ? getCellOccupancy(cell.char) : 1;
            uiCtx.fillStyle = COLOR_TEXT_CURSOR_BG;
            uiCtx.fillRect(
              Math.round(pos.x),
              Math.round(pos.y),
              Math.round(pos.width * occupancy),
              Math.round(pos.height)
            );
            if (cell) {
              setTextRenderStyle(uiCtx, zoom, DEFAULT_GRID_RENDER_METRICS);
              drawTextCell(uiCtx, cell, pos.x, pos.y, {
                color: COLOR_TEXT_CURSOR_FG,
                zoom,
              });
            }
          }
        }

        if (canvasMode !== "animation" && !editingStructuredTextNodeId) {
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
    staticGridSelection,
    staticGridEditMode,
    draggingSelection,
    showGrid,
    hoveredGrid,
    tool,
    canvasMode,
    canvasBounds,
    animationTimeline,
    structuredScene,
    selectedStructuredNodeIds,
    selectedStructuredBoxId,
    structuredGridFocus,
    editingStructuredTextNodeId,
    structuredTextSelection,
    layers,
    hoveredLink,
  ]);
};
