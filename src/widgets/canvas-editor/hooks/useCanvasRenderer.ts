import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BACKGROUND_COLOR,
  COLOR_ACTIVE_CELL_BG,
  COLOR_ACTIVE_CELL_BORDER,
  COLOR_ACTIVE_CELL_MARKER,
  COLOR_SELECTION_BG,
  COLOR_TEXT_CURSOR_BG,
  COLOR_TEXT_CURSOR_FG,
  GRID_COLOR,
} from '@/shared/lib/constants';
import { isStaticGridMode } from '@/domains/sessions/public';
import type { CanvasRenderModel } from './canvasModels';
import { GridManager } from '@/shared/utils/grid';
import type { SelectionArea, GridMap, Point, NodeBounds } from '@/shared/types';
import {
  createGridSurfaceReader,
  isIncrementalCanvasSurfaceReader,
  type CanvasSurfaceReader,
} from '@/domains/canvas/public';
import type { StructuredSplitBoxNode } from '@/domains/structured-content/public';
import type { CanvasLinkHit } from './interaction/core/linkHitTesting';
import { getSelectionBounds } from '@/shared/utils/selection';
import {
  DEFAULT_GRID_RENDER_METRICS,
  drawGridLines,
  drawTextCell,
  getCellOccupancy,
  gridCellRect,
  prepareCanvasSurface,
  setTextRenderStyle,
} from '@/shared/metrics';
import {
  getGridSelectionGeometry,
  getGridSelectionRanges,
  getStaticGridViewState,
  gridRangeFromSelectionArea,
  type GridSelectionGeometry,
} from '@/domains/selection/public';
import {
  getStructuredBoxBounds,
  getStructuredSplitBoxGuides,
} from '@/domains/structured-content/public';
import { getStructuredNodeBounds } from '@/domains/structured-content/public';
import { getStructuredTextSelectionRange } from '@/domains/structured-content/public';
import { createTextLayout, getTextLayoutSelectionRects } from '@/domains/structured-content/public';
import {
  getStructuredLineHandlePoints,
  getStructuredRectHandlePoints,
  getStructuredSplitBoxHandlePoints,
} from '@/domains/structured-content/public';

import type { StructuredMovePreview } from './interaction/structured/structuredInteractionPreview';
import { drawGridLayer } from '../rendering/drawGridLayer';
import type { CanvasEngineRuntime } from '../engine/CanvasEngineRuntime';
import {
  CANVAS_FRAME_INVALIDATION,
  type CanvasFrameInvalidation,
} from '../engine/FrameScheduler';
import { CanvasRenderManager } from '../engine/CanvasRenderManager';
import { shouldDrawCanvasGrid } from '../rendering/canvasLod';
import { CanvasRasterTileCache } from '../rendering/CanvasRasterTileCache';
import {
  offsetCanvasViewportForSurface,
  type CanvasSurfaceGeometry,
} from '../canvasSurfaceGeometry';
export type { StructuredMovePreview } from './interaction/structured/structuredInteractionPreview';

interface LayerRefs {
  surface: React.RefObject<HTMLCanvasElement | null>;
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
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.strokeRect(x, y, width, height);

  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = '#111827';
  ctx.strokeRect(x, y, width, height);

  ctx.strokeStyle = '#f59e0b';
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

export const drawActiveCellFocus = (
  ctx: CanvasRenderingContext2D,
  point: Point,
  viewport: { offset: Point; zoom: number }
) => {
  const pos = gridCellRect(point, viewport);
  ctx.save();
  ctx.fillStyle = COLOR_ACTIVE_CELL_BG;
  ctx.strokeStyle = COLOR_ACTIVE_CELL_BORDER;
  ctx.lineWidth = Math.max(1, Math.round(1.5 * viewport.zoom));
  ctx.fillRect(
    Math.round(pos.x),
    Math.round(pos.y),
    Math.round(pos.width),
    Math.round(pos.height)
  );
  ctx.strokeRect(
    Math.round(pos.x),
    Math.round(pos.y),
    Math.round(pos.width),
    Math.round(pos.height)
  );
  ctx.restore();
};

const drawGridSelectionPreview = (
  ctx: CanvasRenderingContext2D,
  area: SelectionArea,
  viewport: { offset: Point; zoom: number }
) => {
  const { minX, minY, maxX, maxY } = getSelectionBounds(area);
  const pos = gridCellRect({ x: minX, y: minY }, viewport);
  const width = Math.round((maxX - minX + 1) * pos.width);
  const height = Math.round((maxY - minY + 1) * pos.height);
  const x = Math.round(pos.x);
  const y = Math.round(pos.y);

  ctx.save();
  ctx.fillStyle = COLOR_SELECTION_BG;
  ctx.fillRect(x, y, width, height);
  ctx.restore();
};

export const drawGridSelectionGeometry = (
  ctx: CanvasRenderingContext2D,
  geometry: GridSelectionGeometry,
  viewport: { offset: Point; zoom: number }
) => {
  if (geometry.polygons.length === 0) return;
  ctx.save();
  ctx.beginPath();
  geometry.polygons.forEach(({ rings }) => {
    rings.forEach((ring) => {
      ring.forEach((point, index) => {
        const pos = gridCellRect(point, viewport);
        if (index === 0) ctx.moveTo(Math.round(pos.x), Math.round(pos.y));
        else ctx.lineTo(Math.round(pos.x), Math.round(pos.y));
      });
      ctx.closePath();
    });
  });
  ctx.fillStyle = COLOR_SELECTION_BG;
  ctx.fill("evenodd");
  ctx.strokeStyle = COLOR_ACTIVE_CELL_BORDER;
  ctx.lineWidth = Math.max(1, Math.round(2 * viewport.zoom));
  ctx.stroke();
  ctx.restore();
};

export const drawGridActiveCellMarker = (
  ctx: CanvasRenderingContext2D,
  point: Point,
  viewport: { offset: Point; zoom: number }
) => {
  const pos = gridCellRect(point, viewport);
  const inset = Math.max(1, Math.round(viewport.zoom));
  ctx.save();
  ctx.strokeStyle = COLOR_ACTIVE_CELL_MARKER;
  ctx.lineWidth = Math.max(1, Math.round(viewport.zoom));
  ctx.strokeRect(
    Math.round(pos.x) + inset,
    Math.round(pos.y) + inset,
    Math.max(1, Math.round(pos.width) - inset * 2),
    Math.max(1, Math.round(pos.height) - inset * 2)
  );
  ctx.restore();
};

export const useCanvasRenderer = (
  layers: LayerRefs,
  size: { width: number; height: number } | undefined,
  surfaceGeometry: CanvasSurfaceGeometry | undefined,
  store: CanvasRenderModel,
  draggingSelection: SelectionArea | null,
  structuredMovePreviewRef: React.RefObject<StructuredMovePreview | null>,
  hoveredLink: CanvasLinkHit | null,
  requestRenderRef?: React.MutableRefObject<(() => void) | null>,
  onViewportRendered?: (viewport: { offset: Point; zoom: number }) => void,
  runtime?: CanvasEngineRuntime,
  sharedRasterTileCache?: CanvasRasterTileCache,
  paneId = 'single'
) => {
  const {
    activeCanvasId,
    offset,
    zoom,
    grid,
    contentReader,
    scratchLayer,
    textCursor,
    staticGridSelection,
    staticGridEditMode,
    showGrid,
    hoveredGrid,
    tool,
    canvasMode,
    slideDeck,
    selectedStructuredNodeIds,
    structuredContextPoint,
    structuredGridFocus,
    structuredScene,
    editingStructuredTextNodeId,
    structuredTextSelection,
    canvasColorPickerTarget,
  } = store;

  const staticGridView = useMemo(
    () =>
      getStaticGridViewState({
        selection: staticGridSelection,
        editMode: staticGridEditMode,
        textCursor,
        grid,
      }),
    [grid, staticGridEditMode, staticGridSelection, textCursor]
  );
  const renderedTextCursor = canvasMode !== 'structured' ? staticGridView.textCursor : textCursor;
  const [renderManager] = useState(() => new CanvasRenderManager());
  const [localRasterTileCache] = useState(() => new CanvasRasterTileCache());
  const rasterTileCache = sharedRasterTileCache ?? localRasterTileCache;
  useEffect(() => () => localRasterTileCache.clear(), [localRasterTileCache]);
  useEffect(
    () => rasterTileCache.retain(contentReader, paneId),
    [contentReader, paneId, rasterTileCache]
  );
  const manualRenderRafRef = useRef<number | null>(null);
  const manualInvalidationRef = useRef<CanvasFrameInvalidation>(0);
  const observedContentRef = useRef<{
    reader: CanvasSurfaceReader;
    revision: number | null;
  } | null>(null);

  const drawLayer = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      targetGrid: GridMap | null,
      viewBounds: ReturnType<typeof GridManager.getViewportGridBounds>,
      layerZoom: number,
      layerOffset: Point,
      alpha = 1
    ) =>
      drawGridLayer(
        ctx,
        targetGrid ? createGridSurfaceReader(targetGrid) : null,
        viewBounds,
        layerZoom,
        layerOffset,
        {
        alpha,
        hoveredLink,
        }
      ),
    [hoveredLink]
  );
  const drawSurface = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      reader: CanvasSurfaceReader,
      viewBounds: ReturnType<typeof GridManager.getViewportGridBounds>,
      layerZoom: number,
      layerOffset: Point
    ) =>
      drawGridLayer(ctx, reader, viewBounds, layerZoom, layerOffset, { hoveredLink }),
    [hoveredLink]
  );
  useEffect(() => {
    let disposed = false;
    const render = (invalidation: CanvasFrameInvalidation) => {
      if (!size || !surfaceGeometry || size.width === 0 || size.height === 0) return;
      const structuredMovePreview = structuredMovePreviewRef.current;
      const renderedGrid = structuredMovePreview?.baseGrid ?? grid;
      const structuredPreviewMovingGrid = structuredMovePreview?.movingGrid ?? null;
      const renderedStructuredScene = structuredMovePreview
        ? [...structuredMovePreview.baseScene, ...structuredMovePreview.movingNodes]
        : structuredScene;

      const dpr = window.devicePixelRatio || 1;
      const renderOffset = offsetCanvasViewportForSurface(offset, surfaceGeometry);
      const viewBounds = GridManager.getViewportGridBounds(
        surfaceGeometry.width,
        surfaceGeometry.height,
        renderOffset.x,
        renderOffset.y,
        zoom
      );
      const activeSlide = slideDeck?.slides.find(
        (slide) => slide.id === slideDeck.activeSlideId
      );
      const slidePageRect =
        canvasMode === "slide" && activeSlide
          ? (() => {
              const origin = gridCellRect(
                { x: 0, y: 0 },
                { offset: renderOffset, zoom }
              );
              return {
                x: origin.x,
                y: origin.y,
                width: origin.width * activeSlide.size.columns,
                height: origin.height * activeSlide.size.rows,
              };
            })()
          : null;
      const clipToSlidePage = (ctx: CanvasRenderingContext2D) => {
        if (!slidePageRect) return false;
        ctx.save();
        ctx.beginPath();
        ctx.rect(slidePageRect.x, slidePageRect.y, slidePageRect.width, slidePageRect.height);
        ctx.clip();
        return true;
      };
      const compositeInvalidation = invalidation === 0
        ? 0
        : CANVAS_FRAME_INVALIDATION.background |
          CANVAS_FRAME_INVALIDATION.scratch |
          CANVAS_FRAME_INVALIDATION.overlay;
      const renderBackground = CanvasRenderManager.includes(
        compositeInvalidation,
        'background'
      );
      const renderScratch = CanvasRenderManager.includes(compositeInvalidation, 'scratch');
      const renderOverlay = CanvasRenderManager.includes(compositeInvalidation, 'overlay');
      let renderedInvalidation = 0;

      const bgCanvas = layers.surface.current;
      const bgCtx = bgCanvas?.getContext('2d', { alpha: false });
      if (renderBackground && bgCanvas && bgCtx) {
        const drawVisibleGrid = showGrid && shouldDrawCanvasGrid(zoom);
        prepareCanvasSurface(
          bgCanvas,
          bgCtx,
          surfaceGeometry.width,
          surfaceGeometry.height,
          dpr
        );
          bgCtx.fillStyle = slidePageRect ? "#e5e7eb" : BACKGROUND_COLOR;
          bgCtx.fillRect(0, 0, surfaceGeometry.width, surfaceGeometry.height);
          if (slidePageRect) {
            bgCtx.save();
            bgCtx.shadowColor = "rgba(15, 23, 42, 0.18)";
            bgCtx.shadowBlur = 18;
            bgCtx.shadowOffsetY = 4;
            bgCtx.fillStyle = BACKGROUND_COLOR;
            bgCtx.fillRect(
              slidePageRect.x,
              slidePageRect.y,
              slidePageRect.width,
              slidePageRect.height
            );
            bgCtx.restore();
            clipToSlidePage(bgCtx);
          }

          if (drawVisibleGrid) {
            drawGridLines(bgCtx, {
              startX: viewBounds.startX,
              endX: viewBounds.endX,
              startY: viewBounds.startY,
              endY: viewBounds.endY,
              offsetX: renderOffset.x,
              offsetY: renderOffset.y,
              width: surfaceGeometry.width,
              height: surfaceGeometry.height,
              zoom,
              color: GRID_COLOR,
            });
          }
          if (structuredMovePreview) {
            drawLayer(bgCtx, renderedGrid, viewBounds, zoom, renderOffset);
          } else if (hoveredLink || slidePageRect) {
            drawSurface(bgCtx, contentReader, viewBounds, zoom, renderOffset);
          } else {
            const rasterResult = rasterTileCache.draw(
              bgCtx,
              contentReader,
              viewBounds,
              zoom,
              renderOffset,
              dpr,
              {
                paneId,
                mode: runtime?.renderActivity.getMode() ?? "settled",
                onTileReady: () => {
                if (!disposed) {
                  scheduleRender(CANVAS_FRAME_INVALIDATION.background);
                }
                },
              }
            );
            const redrawBounds = [
              ...rasterResult.uncoveredBounds,
              ...rasterResult.patchBounds,
            ];
            for (const bounds of redrawBounds) {
              const position = GridManager.gridToScreen(
                bounds.x,
                bounds.y,
                renderOffset.x,
                renderOffset.y,
                zoom
              );
              const width = bounds.width * DEFAULT_GRID_RENDER_METRICS.cellWidth * zoom;
              const height = bounds.height * DEFAULT_GRID_RENDER_METRICS.cellHeight * zoom;
              bgCtx.save();
              bgCtx.beginPath();
              bgCtx.rect(position.x, position.y, width, height);
              bgCtx.clip();
              bgCtx.fillStyle = BACKGROUND_COLOR;
              bgCtx.fillRect(position.x, position.y, width, height);
              if (drawVisibleGrid) {
                drawGridLines(bgCtx, {
                  startX: bounds.x,
                  endX: bounds.x + bounds.width - 1,
                  startY: bounds.y,
                  endY: bounds.y + bounds.height - 1,
                  offsetX: renderOffset.x,
                  offsetY: renderOffset.y,
                  width: surfaceGeometry.width,
                  height: surfaceGeometry.height,
                  zoom,
                  color: GRID_COLOR,
                });
              }
              drawSurface(
                bgCtx,
                contentReader,
                {
                  startX: bounds.x,
                  endX: bounds.x + bounds.width - 1,
                  startY: bounds.y,
                  endY: bounds.y + bounds.height - 1,
                },
                zoom,
                renderOffset
              );
              bgCtx.restore();
            }
          }
        if (slidePageRect) bgCtx.restore();
        renderedInvalidation |= CANVAS_FRAME_INVALIDATION.background;
      }

      const scratchCanvas = bgCanvas;
      const scratchCtx = bgCtx;
      if (renderScratch && scratchCanvas && scratchCtx) {
        clipToSlidePage(scratchCtx);
        drawLayer(
          scratchCtx,
          scratchLayer,
          viewBounds,
          zoom,
          renderOffset
        );
        if (slidePageRect) scratchCtx.restore();
        renderedInvalidation |= CANVAS_FRAME_INVALIDATION.scratch;
      }

      const uiCanvas = bgCanvas;
      const uiCtx = bgCtx;
      if (renderOverlay && uiCanvas && uiCtx) {
        clipToSlidePage(uiCtx);

        if (canvasMode !== 'structured') {
          const ranges = getGridSelectionRanges(staticGridSelection);
          const geometry = draggingSelection
            ? getGridSelectionGeometry([
                ...ranges,
                gridRangeFromSelectionArea(draggingSelection),
              ], grid)
            : staticGridView.selectionGeometry;
          drawGridSelectionGeometry(uiCtx, geometry, {
            offset: renderOffset,
            zoom,
          });
        } else if (draggingSelection) {
          drawGridSelectionPreview(
            uiCtx,
            draggingSelection,
            { offset: renderOffset, zoom }
          );
        }
        if (canvasMode === 'structured' && structuredPreviewMovingGrid) {
          drawLayer(uiCtx, structuredPreviewMovingGrid, viewBounds, zoom, renderOffset);
        }

        if (canvasMode === 'structured') {
          if (
            structuredGridFocus &&
            !editingStructuredTextNodeId &&
            selectedStructuredNodeIds.length === 0
          ) {
            drawActiveCellFocus(uiCtx, structuredGridFocus, {
              offset: renderOffset,
              zoom,
            });
          }

          const selectionRange = getStructuredTextSelectionRange(structuredTextSelection);
          const selectedTextNode =
            selectionRange && structuredTextSelection
              ? renderedStructuredScene.find(
                  (node) => node.id === structuredTextSelection.nodeId && node.type === 'text'
                )
              : null;
          if (selectedTextNode?.type === 'text') {
            getTextLayoutSelectionRects(
              createTextLayout(selectedTextNode.text, selectedTextNode.position),
              selectionRange!.start,
              selectionRange!.end
            ).forEach((rect) => {
              const pos = gridCellRect(rect.point, { offset: renderOffset, zoom });
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

        if (canvasMode === 'structured' && selectedStructuredNodeIds.length > 0) {
          const selectedIds = new Set(selectedStructuredNodeIds);
          const selectedNodes = renderedStructuredScene.filter(
            (node) =>
              selectedIds.has(node.id) &&
              !(
                editingStructuredTextNodeId &&
                node.id === editingStructuredTextNodeId &&
                node.type === 'text'
              )
          );
          const drawStructuredBounds = (bounds: NodeBounds) => {
            const pos = gridCellRect(
              { x: bounds.x, y: bounds.y },
              { offset: renderOffset, zoom }
            );
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
          const drawActiveSplitBoxLeaf = (node: StructuredSplitBoxNode, point: Point | null) => {
            const activeLeafBounds = getStructuredSplitBoxActiveLeafBounds(node, point);
            if (!activeLeafBounds) return;

            const pos = gridCellRect(
              { x: activeLeafBounds.x, y: activeLeafBounds.y },
              { offset: renderOffset, zoom }
            );
            const width = activeLeafBounds.width * pos.width;
            const height = activeLeafBounds.height * pos.height;
            uiCtx.save();
            uiCtx.fillStyle = 'rgba(37, 99, 235, 0.06)';
            uiCtx.strokeStyle = '#2563eb';
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
          uiCtx.strokeStyle = '#2563eb';
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
              ? renderedStructuredScene.find((node) => node.id === selectedStructuredNodeIds[0])
              : null;
          if (
            selectedHandleNode?.type === 'box' ||
            selectedHandleNode?.type === 'splitBox' ||
            selectedHandleNode?.type === 'bg'
          ) {
            const bounds =
              selectedHandleNode.type === 'box'
                ? getStructuredBoxBounds(selectedHandleNode)
                : getStructuredNodeBounds(selectedHandleNode);
            const { pos, width, height } = drawStructuredBounds(bounds);
            uiCtx.fillStyle = '#ffffff';
            uiCtx.strokeStyle = '#2563eb';
            uiCtx.lineWidth = 1;
            if (selectedHandleNode.type === 'splitBox') {
              drawActiveSplitBoxLeaf(selectedHandleNode, hoveredGrid ?? structuredContextPoint);
              getStructuredSplitBoxHandlePoints(selectedHandleNode).forEach(({ point }) => {
                const handlePos = gridCellRect(point, { offset: renderOffset, zoom });
                drawHandle(handlePos.x + handlePos.width / 2, handlePos.y + handlePos.height / 2);
              });
            } else {
              getStructuredRectHandlePoints(bounds).forEach(({ xRatio, yRatio }) => {
                const px = pos.x + width * xRatio;
                const py = pos.y + height * yRatio;
                drawHandle(px, py);
              });
            }
          } else if (selectedHandleNode?.type === 'line') {
            uiCtx.fillStyle = '#ffffff';
            uiCtx.strokeStyle = '#2563eb';
            uiCtx.lineWidth = 1;
            getStructuredLineHandlePoints().forEach(({ point }) => {
              const endpoint = selectedHandleNode[point];
              const pos = gridCellRect(endpoint, { offset: renderOffset, zoom });
              drawHandle(pos.x + pos.width / 2, pos.y + pos.height / 2);
            });
          }
          uiCtx.restore();
        }

        if (tool === 'eraser' && hoveredGrid) {
          const pos = gridCellRect(hoveredGrid, { offset: renderOffset, zoom });
          uiCtx.fillStyle = 'rgba(239, 68, 68, 0.3)';
          uiCtx.fillRect(
            Math.round(pos.x),
            Math.round(pos.y),
            Math.round(pos.width),
            Math.round(pos.height)
          );
        }

        if (renderedTextCursor && !isStaticGridMode(canvasMode)) {
          const pos = gridCellRect(renderedTextCursor, { offset: renderOffset, zoom });
          if (canvasMode === 'structured' && editingStructuredTextNodeId) {
            uiCtx.fillStyle = COLOR_TEXT_CURSOR_BG;
            uiCtx.fillRect(
              Math.round(pos.x),
              Math.round(pos.y),
              Math.max(1, Math.round(2 * zoom)),
              Math.round(pos.height)
            );
          } else {
            const cell = renderedGrid.get(
              GridManager.toKey(renderedTextCursor.x, renderedTextCursor.y)
            );
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

        if (canvasColorPickerTarget && hoveredGrid) {
          drawCanvasColorPickerAnchor(uiCtx, hoveredGrid, {
            offset: renderOffset,
            zoom,
          });
        }
        if (slidePageRect) uiCtx.restore();
        renderedInvalidation |= CANVAS_FRAME_INVALIDATION.overlay;
      }
      renderManager.commit(renderedInvalidation);
      if (
        CanvasRenderManager.includes(renderedInvalidation, 'background') ||
        CanvasRenderManager.includes(renderedInvalidation, 'scratch')
      ) {
        onViewportRendered?.({ offset: { ...offset }, zoom });
      }
    };

    const scheduleRender = (invalidation: CanvasFrameInvalidation) => {
      if (invalidation === 0) return;
      if (runtime) {
        runtime.frameScheduler.request(
          "canvas-renderer",
          invalidation,
          (_timestamp, pendingInvalidation) => render(pendingInvalidation)
        );
        return;
      }
      manualInvalidationRef.current |= invalidation;
      if (manualRenderRafRef.current !== null) return;
      manualRenderRafRef.current = requestAnimationFrame(() => {
        manualRenderRafRef.current = null;
        const pendingInvalidation = manualInvalidationRef.current;
        manualInvalidationRef.current = 0;
        render(pendingInvalidation);
      });
    };
    const structuredMovePreview = structuredMovePreviewRef.current;
    const sharedViewportInputs = [
      size?.width,
      size?.height,
      activeCanvasId,
      offset,
      zoom,
      canvasMode,
      slideDeck,
    ];
    const contentRevision = isIncrementalCanvasSurfaceReader(contentReader)
      ? contentReader.getRevision()
      : null;
    const observedContent = observedContentRef.current;
    if (
      runtime &&
      observedContent?.reader === contentReader &&
      observedContent.revision !== null &&
      contentRevision !== null &&
      observedContent.revision !== contentRevision
    ) {
      runtime.renderActivity.markContentActivity();
    }
    observedContentRef.current = { reader: contentReader, revision: contentRevision };
    const invalidation = renderManager.update({
      background: [
        layers.surface.current,
        ...sharedViewportInputs,
        contentReader,
        contentRevision ?? grid,
        showGrid,
        hoveredLink,
        structuredMovePreview?.baseGrid ?? null,
      ],
      scratch: [
        layers.surface.current,
        ...sharedViewportInputs,
        scratchLayer,
      ],
      overlay: [
        layers.surface.current,
        ...sharedViewportInputs,
        grid,
        textCursor,
        staticGridSelection,
        staticGridEditMode,
        draggingSelection,
        hoveredGrid,
        tool,
        structuredScene,
        selectedStructuredNodeIds,
        structuredContextPoint,
        structuredGridFocus,
        editingStructuredTextNodeId,
        structuredTextSelection,
        canvasColorPickerTarget,
        structuredMovePreview?.movingGrid ?? null,
      ],
    });
    const requestManualRender = () =>
      scheduleRender(
        CANVAS_FRAME_INVALIDATION.background |
          CANVAS_FRAME_INVALIDATION.overlay
      );
    if (requestRenderRef) {
      requestRenderRef.current = requestManualRender;
    }
    const fonts = document.fonts;
    const handleFontLoad = () => {
      rasterTileCache.clear();
      scheduleRender(renderManager.reset());
    };
    fonts?.addEventListener('loadingdone', handleFontLoad);
    const unsubscribeActivity = runtime?.renderActivity.subscribe((mode) => {
      if (mode === "settled" && !disposed) {
        scheduleRender(CANVAS_FRAME_INVALIDATION.background);
      }
    });

    scheduleRender(invalidation);
    return () => {
      disposed = true;
      runtime?.frameScheduler.cancel("canvas-renderer");
      if (manualRenderRafRef.current !== null) {
        cancelAnimationFrame(manualRenderRafRef.current);
        manualRenderRafRef.current = null;
      }
      manualInvalidationRef.current = 0;
      if (requestRenderRef?.current === requestManualRender) {
        requestRenderRef.current = null;
      }
      fonts?.removeEventListener('loadingdone', handleFontLoad);
      unsubscribeActivity?.();
    };
  }, [
    activeCanvasId,
    offset,
    zoom,
    size,
    surfaceGeometry,
    grid,
    contentReader,
    scratchLayer,
    textCursor,
    staticGridSelection,
    staticGridEditMode,
    draggingSelection,
    showGrid,
    hoveredGrid,
    tool,
    canvasMode,
    slideDeck,
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
    drawSurface,
    onViewportRendered,
    renderedTextCursor,
    staticGridView.activeCell,
    staticGridView.hasSelection,
    staticGridView.selectionGeometry,
    renderManager,
    rasterTileCache,
    sharedRasterTileCache,
    paneId,
    runtime,
  ]);
};
