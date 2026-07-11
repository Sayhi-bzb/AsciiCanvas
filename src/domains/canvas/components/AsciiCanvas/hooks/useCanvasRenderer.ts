import { useCallback, useEffect, useRef } from "react";
import {
  BACKGROUND_COLOR,
  COLOR_ORIGIN_MARKER,
  COLOR_SELECTION_BG,
  COLOR_TEXT_CURSOR_BG,
  COLOR_TEXT_CURSOR_FG,
  GRID_COLOR,
} from "@/shared/lib/constants";
import type { CanvasRenderModel } from "./canvasModels";
import { GridManager } from "@/shared/utils/grid";
import type { SelectionArea, GridMap, Point, NodeBounds, StructuredSplitBoxNode, AnimationFrame } from "@/shared/types";
import type { CanvasLinkHit } from "./interaction/core/linkHitTesting";
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
} from "@/shared/metrics";
import { getStaticGridViewState } from "@/domains/canvas/state/helpers/staticGridModel";
import {
  getStructuredBoxBounds,
  getStructuredSplitBoxGuides,
} from "@/domains/canvas/state/helpers/structuredBoxEditing";
import { getStructuredNodeBounds } from "@/shared/utils/structured";
import { getStructuredTextSelectionRange } from "@/shared/utils/structuredTextRanges";
import {
  createTextLayout,
  getTextLayoutSelectionRects,
} from "@/shared/utils/textLayout";
import {
  getStructuredLineHandlePoints,
  getStructuredRectHandlePoints,
  getStructuredSplitBoxHandlePoints,
} from "@/domains/canvas/state/helpers/structuredHandleGeometry";

import type { StructuredMovePreview } from "./interaction/structured/structuredInteractionPreview";
import { drawGridLayer } from "../rendering/drawGridLayer";
export type { StructuredMovePreview } from "./interaction/structured/structuredInteractionPreview";

interface LayerRefs {
  bg: React.RefObject<HTMLCanvasElement | null>;
  scratch: React.RefObject<HTMLCanvasElement | null>;
  ui: React.RefObject<HTMLCanvasElement | null>;
}

export const getStructuredSplitBoxActiveLeafBounds = (
  node: StructuredSplitBoxNode,
  point: Point | null
): NodeBounds | null => {
  if (!point) return null;
  const leaf = getStructuredSplitBoxGuides(node).leafBounds.find(
    ({ bounds }) =>
      point.x >= bounds.x &&
      point.x < bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y < bounds.y + bounds.height
  );
  return leaf?.bounds ?? null;
};

export const drawCanvasColorPickerAnchor = (
  ctx: CanvasRenderingContext2D,
  point: Point,
  viewport: { offset: Point; zoom: number }
) => {
  const pos = gridCellRect(point, viewport);
  const x = Math.round(pos.x);
  const y = Math.round(pos.y);
  const width = Math.round(pos.width);
  const height = Math.round(pos.height);
  const corner = Math.max(4, Math.round(Math.min(width, height) * 0.32));
  const lineWidth = Math.max(1, Math.round(1.5 * viewport.zoom));

  ctx.save();
  ctx.lineWidth = lineWidth + 2;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.strokeRect(x, y, width, height);

  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = "#111827";
  ctx.strokeRect(x, y, width, height);

  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = Math.max(2, lineWidth);
  ctx.beginPath();
  ctx.moveTo(x, y + corner);
  ctx.lineTo(x, y);
  ctx.lineTo(x + corner, y);
  ctx.moveTo(x + width - corner, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + corner);
  ctx.moveTo(x + width, y + height - corner);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x + width - corner, y + height);
  ctx.moveTo(x + corner, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + height - corner);
  ctx.stroke();
  ctx.restore();
};

export const useCanvasRenderer = (
  layers: LayerRefs,
  size: { width: number; height: number } | undefined,
  store: CanvasRenderModel,
  draggingSelection: SelectionArea | null,
  structuredMovePreviewRef: React.RefObject<StructuredMovePreview | null>,
  hoveredLink: CanvasLinkHit | null,
  requestRenderRef?: React.MutableRefObject<(() => void) | null>
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
    animationPlaybackFrameId,
    selectedStructuredNodeIds,
    structuredContextPoint,
    structuredGridFocus,
    structuredScene,
    editingStructuredTextNodeId,
    structuredTextSelection,
    canvasColorPickerTarget,
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
  const baseRenderInputsRef = useRef<unknown[] | null>(null);
  const manualRenderRafRef = useRef<number | null>(null);
  const animationFrameGridCacheRef = useRef<
    Map<string, { entries: AnimationFrame["grid"]; grid: GridMap }>
  >(new Map());

  const shouldRenderBaseLayers = (inputs: unknown[]) => {
    const previous = baseRenderInputsRef.current;
    const changed =
      !previous ||
      previous.length !== inputs.length ||
      inputs.some((input, index) => input !== previous[index]);
    if (changed) baseRenderInputsRef.current = inputs;
    return changed;
  };

  const drawLayer = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      targetGrid: GridMap | null,
      viewBounds: ReturnType<typeof GridManager.getViewportGridBounds>,
      layerZoom: number,
      layerOffset: Point,
      alpha = 1
    ) =>
      drawGridLayer(ctx, targetGrid, viewBounds, layerZoom, layerOffset, {
        alpha,
        hoveredLink,
      }),
    [hoveredLink]
  );
  useEffect(() => {
    const getCachedAnimationFrameGrid = (frame: AnimationFrame) => {
      const cached = animationFrameGridCacheRef.current.get(frame.id);
      if (cached?.entries === frame.grid) return cached.grid;
      const grid = createMapFromEntries(frame.grid);
      animationFrameGridCacheRef.current.set(frame.id, {
        entries: frame.grid,
        grid,
      });
      return grid;
    };

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
        animationPlaybackFrameId ?? animationTimeline.currentFrameId
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
          grid: getCachedAnimationFrameGrid(frame),
          alpha,
        });
      }

      for (let i = 1; i <= forwardLayers; i++) {
        const frame = animationTimeline.frames[currentIndex + i];
        const alpha = opacityFalloff[i - 1] ?? 0;
        if (!frame || alpha <= 0) continue;
        layers.push({
          grid: getCachedAnimationFrameGrid(frame),
          alpha,
        });
      }

      return layers;
    };

    const render = () => {
      if (!size || size.width === 0 || size.height === 0) return;
      const structuredMovePreview = structuredMovePreviewRef.current;
      const renderedGrid = structuredMovePreview?.baseGrid ?? grid;
      const structuredPreviewMovingGrid =
        structuredMovePreview?.movingGrid ?? null;
      const renderedStructuredScene = structuredMovePreview
        ? [...structuredMovePreview.baseScene, ...structuredMovePreview.movingNodes]
        : structuredScene;

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
      const renderBaseLayers = shouldRenderBaseLayers([
        layers.bg.current,
        layers.scratch.current,
        size.width,
        size.height,
        offset,
        zoom,
        grid,
        scratchLayer,
        showGrid,
        canvasMode,
        canvasBounds,
        animationTimeline,
        hoveredLink,
        structuredMovePreview?.baseGrid ?? null,
      ]);

      const bgCanvas = layers.bg.current;
      const bgCtx = bgCanvas?.getContext("2d", { alpha: false });
      if (renderBaseLayers && bgCanvas && bgCtx) {
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
          renderedGrid,
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
      if (renderBaseLayers && scratchCanvas && scratchCtx) {
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

        if (canvasMode === "structured" && structuredPreviewMovingGrid) {
          drawLayer(uiCtx, structuredPreviewMovingGrid, viewBounds, zoom, offset);
        }

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
                ? renderedStructuredScene.find(
                  (node) =>
                    node.id === structuredTextSelection.nodeId &&
                    node.type === "text"
                )
              : null;
          if (selectedTextNode?.type === "text") {
            getTextLayoutSelectionRects(
              createTextLayout(selectedTextNode.text, selectedTextNode.position),
              selectionRange!.start,
              selectionRange!.end
            ).forEach((rect) => {
                const pos = gridCellRect(
                  rect.point,
                  { offset, zoom }
                );
                uiCtx.fillStyle = COLOR_SELECTION_BG;
                uiCtx.fillRect(
                  Math.round(pos.x),
                  Math.round(pos.y),
                  Math.round(pos.width * rect.width),
                  Math.round(pos.height)
                );
            });
          }
        }

        if (canvasMode === "structured" && selectedStructuredNodeIds.length > 0) {
          const selectedIds = new Set(selectedStructuredNodeIds);
          const selectedNodes = renderedStructuredScene.filter(
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
          const drawActiveSplitBoxLeaf = (
            node: StructuredSplitBoxNode,
            point: Point | null
          ) => {
            const activeLeafBounds = getStructuredSplitBoxActiveLeafBounds(
              node,
              point
            );
            if (!activeLeafBounds) return;

            const pos = gridCellRect(
              { x: activeLeafBounds.x, y: activeLeafBounds.y },
              { offset, zoom }
            );
            const width = activeLeafBounds.width * pos.width;
            const height = activeLeafBounds.height * pos.height;
            uiCtx.save();
            uiCtx.fillStyle = "rgba(37, 99, 235, 0.06)";
            uiCtx.strokeStyle = "#2563eb";
            uiCtx.lineWidth = Math.max(2, Math.round(3 * zoom));
            uiCtx.fillRect(
              Math.round(pos.x),
              Math.round(pos.y),
              Math.round(width),
              Math.round(height)
            );
            uiCtx.strokeRect(
              Math.round(pos.x),
              Math.round(pos.y),
              Math.round(width),
              Math.round(height)
            );
            uiCtx.restore();
          };

          uiCtx.save();
          uiCtx.strokeStyle = "#2563eb";
          uiCtx.lineWidth = Math.max(1, Math.round(2 * zoom));
          selectedNodes.forEach((node) => drawStructuredBounds(getStructuredNodeBounds(node)));

          const drawHandle = (x: number, y: number) => {
            const handleSize = Math.max(6, Math.round(7 * zoom));
            uiCtx.fillRect(
              Math.round(x - handleSize / 2),
              Math.round(y - handleSize / 2),
              handleSize,
              handleSize
            );
            uiCtx.strokeRect(
              Math.round(x - handleSize / 2),
              Math.round(y - handleSize / 2),
              handleSize,
              handleSize
            );
          };

          const selectedHandleNode =
            selectedStructuredNodeIds.length === 1
              ? renderedStructuredScene.find(
                  (node) => node.id === selectedStructuredNodeIds[0]
                )
              : null;
          if (
            selectedHandleNode?.type === "box" ||
            selectedHandleNode?.type === "splitBox" ||
            selectedHandleNode?.type === "bg"
          ) {
            const bounds =
              selectedHandleNode.type === "box"
                ? getStructuredBoxBounds(selectedHandleNode)
                : getStructuredNodeBounds(selectedHandleNode);
            const { pos, width, height } = drawStructuredBounds(bounds);
            uiCtx.fillStyle = "#ffffff";
            uiCtx.strokeStyle = "#2563eb";
            uiCtx.lineWidth = 1;
            if (selectedHandleNode.type === "splitBox") {
              drawActiveSplitBoxLeaf(
                selectedHandleNode,
                hoveredGrid ?? structuredContextPoint
              );
              getStructuredSplitBoxHandlePoints(selectedHandleNode).forEach(
                ({ point }) => {
                  const handlePos = gridCellRect(point, { offset, zoom });
                  drawHandle(
                    handlePos.x + handlePos.width / 2,
                    handlePos.y + handlePos.height / 2
                  );
                }
              );
            } else {
              getStructuredRectHandlePoints(bounds).forEach(({ xRatio, yRatio }) => {
                const px = pos.x + width * xRatio;
                const py = pos.y + height * yRatio;
                drawHandle(px, py);
              });
            }
          } else if (selectedHandleNode?.type === "line") {
            uiCtx.fillStyle = "#ffffff";
            uiCtx.strokeStyle = "#2563eb";
            uiCtx.lineWidth = 1;
            getStructuredLineHandlePoints().forEach(({ point }) => {
              const endpoint = selectedHandleNode[point];
              const pos = gridCellRect(endpoint, { offset, zoom });
              drawHandle(pos.x + pos.width / 2, pos.y + pos.height / 2);
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
            const cell = renderedGrid.get(GridManager.toKey(renderedTextCursor.x, renderedTextCursor.y));
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

        if (canvasColorPickerTarget && hoveredGrid) {
          drawCanvasColorPickerAnchor(uiCtx, hoveredGrid, { offset, zoom });
        }
      }
    };

    const scheduleRender = () => {
      if (manualRenderRafRef.current !== null) return;
      manualRenderRafRef.current = requestAnimationFrame(() => {
        manualRenderRafRef.current = null;
        render();
      });
    };
    if (requestRenderRef) {
      requestRenderRef.current = scheduleRender;
    }

    const requestId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(requestId);
      if (manualRenderRafRef.current !== null) {
        cancelAnimationFrame(manualRenderRafRef.current);
        manualRenderRafRef.current = null;
      }
      if (requestRenderRef?.current === scheduleRender) {
        requestRenderRef.current = null;
      }
    };
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
    animationPlaybackFrameId,
    structuredScene,
    selectedStructuredNodeIds,
    structuredContextPoint,
    structuredGridFocus,
    editingStructuredTextNodeId,
    structuredTextSelection,
    canvasColorPickerTarget,
    layers,
    hoveredLink,
    structuredMovePreviewRef,
    requestRenderRef,
    drawLayer,
    renderedSelections,
    renderedTextCursor,
  ]);
};

