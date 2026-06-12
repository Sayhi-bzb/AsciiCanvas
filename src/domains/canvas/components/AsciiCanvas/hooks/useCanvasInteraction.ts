import { useEffect, useRef, useState } from "react";
import { useGesture } from "@use-gesture/react";
import { useCreation, useThrottleFn } from "ahooks";
import { GridManager } from "@/shared/utils/grid";
import type { Point, SelectionArea, ToolType } from "@/shared/types";
import type { CanvasState } from "@/domains/canvas/state/canvasStore";
import { forceHistorySave } from "@/shared/lib/yjs-setup";
import bresenham from "bresenham";
import { isCtrlOrMeta } from "@/shared/utils/event";
import { MIN_ZOOM, MAX_ZOOM } from "@/shared/lib/constants";
import {
  clampPointToBounds,
  clampSelectionToBounds,
  isPointWithinBounds,
} from "@/domains/canvas/state/helpers/animationHelpers";

const isShapeTool = (tool: ToolType, canvasMode: CanvasState["canvasMode"]): boolean => {
  if (canvasMode === "structured") return tool === "box" || tool === "line";
  return ["box", "circle", "line", "stepline"].includes(tool);
};

type InteractionMode =
  | "idle"
  | "panning"
  | "selecting"
  | "drawing"
  | "shape-preview";

const isSelectionTool = (
  tool: ToolType,
  canvasMode: CanvasState["canvasMode"]
) => {
  if (canvasMode === "structured") return tool === "select";
  return tool === "select" || tool === "fill";
};

const isFromMinimap = (event: Event | undefined) => {
  const target = event?.target;
  if (!(target instanceof Element)) return false;
  return !!target.closest('[data-minimap-root="true"]');
};

export const useCanvasInteraction = (
  store: Pick<
    CanvasState,
    | "tool"
    | "brushChar"
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
  >,
  containerRef: React.RefObject<HTMLDivElement | null>
) => {
  const {
    tool,
    brushChar,
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
  } = store;

  const resolveGridPointFromScreen = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const raw = GridManager.screenToGrid(
      clientX - rect.left,
      clientY - rect.top,
      offset.x,
      offset.y,
      zoom
    );
    const snapped = GridManager.snapToCharStart(raw, grid);
    return canvasMode === "animation"
      ? clampPointToBounds(snapped, canvasBounds)
      : snapped;
  };

  const dragStartGrid = useRef<Point | null>(null);
  const lastGrid = useRef<Point | null>(null);
  const lastPlacedGrid = useRef<Point | null>(null);
  const anchorGrid = useRef<Point | null>(null);

  const isPanningRef = useRef(false);
  const queuedOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const queuedOffsetRafRef = useRef<number | null>(null);
  const interactionModeRef = useRef<InteractionMode>("idle");
  const lineAxisRef = useRef<"vertical" | "horizontal" | null>(null);
  const [draggingSelection, setDraggingSelection] =
    useState<SelectionArea | null>(null);

  const resetDragState = () => {
    dragStartGrid.current = null;
    lastGrid.current = null;
    lastPlacedGrid.current = null;
    lineAxisRef.current = null;
    interactionModeRef.current = "idle";
  };

  const shouldIgnoreMinimapGestureEvent = (event: Event | undefined) => {
    if (!isFromMinimap(event)) return false;
    return (
      interactionModeRef.current === "idle" &&
      dragStartGrid.current === null &&
      !isPanningRef.current
    );
  };

  const flushQueuedOffset = () => {
    if (queuedOffsetRafRef.current !== null) {
      window.cancelAnimationFrame(queuedOffsetRafRef.current);
      queuedOffsetRafRef.current = null;
    }
    const { x, y } = queuedOffsetRef.current;
    if (x === 0 && y === 0) return;
    queuedOffsetRef.current = { x: 0, y: 0 };
    setOffset((prev: Point) => ({ x: prev.x + x, y: prev.y + y }));
  };

  const queueOffsetDelta = (dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return;
    queuedOffsetRef.current = {
      x: queuedOffsetRef.current.x + dx,
      y: queuedOffsetRef.current.y + dy,
    };
    if (queuedOffsetRafRef.current !== null) return;
    queuedOffsetRafRef.current = window.requestAnimationFrame(() => {
      queuedOffsetRafRef.current = null;
      const { x, y } = queuedOffsetRef.current;
      if (x === 0 && y === 0) return;
      queuedOffsetRef.current = { x: 0, y: 0 };
      setOffset((prev: Point) => ({ x: prev.x + x, y: prev.y + y }));
    });
  };

  useEffect(() => {
    return () => {
      if (queuedOffsetRafRef.current !== null) {
        window.cancelAnimationFrame(queuedOffsetRafRef.current);
      }
    };
  }, []);

  const handleDrawing = useCreation(
    () => (currentGrid: Point) => {
      if (
        !lastGrid.current ||
        (currentGrid.x === lastGrid.current.x &&
          currentGrid.y === lastGrid.current.y)
      )
        return;
      const points = bresenham(
        lastGrid.current.x,
        lastGrid.current.y,
        currentGrid.x,
        currentGrid.y
      );

      if (tool === "brush") {
        const charWidth = GridManager.getCharWidth(brushChar);
        if (charWidth > 1) {
          const filteredPoints: Point[] = [];
          points.forEach((p) => {
            if (!lastPlacedGrid.current) {
              filteredPoints.push(p);
              lastPlacedGrid.current = p;
            } else {
              const dx = Math.abs(p.x - lastPlacedGrid.current.x);
              const dy = Math.abs(p.y - lastPlacedGrid.current.y);
              if (dx >= charWidth || dy >= 1) {
                filteredPoints.push(p);
                lastPlacedGrid.current = p;
              }
            }
          });
          if (filteredPoints.length > 0) {
            addScratchPoints(
              filteredPoints.map((p) => ({ ...p, char: brushChar }))
            );
          }
        } else {
          addScratchPoints(points.map((p) => ({ ...p, char: brushChar })));
        }
      } else if (tool === "eraser") {
        erasePoints(points, false);
      }
      lastGrid.current = currentGrid;
    },
    [tool, brushChar, addScratchPoints, erasePoints]
  );

  const { run: throttledDraw } = useThrottleFn(handleDrawing, {
    wait: 8,
    trailing: true,
  });

  const pinchStartZoomRef = useRef(zoom);

  const bind = useGesture(
    {
      onPinchStart: () => {
        pinchStartZoomRef.current = zoom;
      },
      onPinch: ({ offset: [scale], origin: [ox, oy], event }) => {
        event.preventDefault();
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const nextZoom = Math.max(
          MIN_ZOOM,
          Math.min(MAX_ZOOM, pinchStartZoomRef.current * scale)
        );

        if (nextZoom !== zoom) {
          setZoom(() => nextZoom);
          if (canvasMode !== "animation") {
            const mouseX = ox - rect.left;
            const mouseY = oy - rect.top;
            const actualScale = nextZoom / zoom;
            setOffset((prev: Point) => ({
              x: mouseX - (mouseX - prev.x) * actualScale,
              y: mouseY - (mouseY - prev.y) * actualScale,
            }));
          }
        }
      },
      onPinchEnd: () => {
        // Pinch gesture ended
      },
      onMove: ({ xy: [x, y], event }) => {
        if (isFromMinimap(event)) return;
        if (canvasMode === "structured") return;
        if (tool !== "eraser") return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const raw = GridManager.screenToGrid(
            x - rect.left,
            y - rect.top,
            offset.x,
            offset.y,
            zoom
          );
          if (canvasMode === "animation" && !isPointWithinBounds(raw, canvasBounds)) {
            setHoveredGrid(null);
            return;
          }
          setHoveredGrid(
            canvasMode === "animation"
              ? clampPointToBounds(raw, canvasBounds)
              : raw
          );
        }
      },
      onDragStart: ({ xy: [x, y], event }) => {
        if (isFromMinimap(event)) return;
        const mouseEvent = event as MouseEvent;
        if (
          canvasMode !== "animation" &&
          (mouseEvent.button === 1 || isCtrlOrMeta(mouseEvent))
        ) {
          isPanningRef.current = true;
          interactionModeRef.current = "panning";
          document.body.style.cursor = "grabbing";
          return;
        }

        const rect = containerRef.current?.getBoundingClientRect();
        if (mouseEvent.button === 0 && rect) {
          const raw = GridManager.screenToGrid(
            x - rect.left,
            y - rect.top,
            offset.x,
            offset.y,
            zoom
          );
          const start =
            canvasMode === "animation"
              ? clampPointToBounds(GridManager.snapToCharStart(raw, grid), canvasBounds)
              : GridManager.snapToCharStart(raw, grid);

          if (isSelectionTool(tool, canvasMode)) {
            interactionModeRef.current = "selecting";
            if (
              tool === "select" &&
              mouseEvent.shiftKey &&
              anchorGrid.current
            ) {
              clearInteractionState();
              dragStartGrid.current = { ...anchorGrid.current };
              setDraggingSelection({
                start: { ...anchorGrid.current },
                end: start,
              });
              return;
            }

            if (!mouseEvent.shiftKey) {
              clearSelections();
              anchorGrid.current = start;
            } else if (tool === "select" && !anchorGrid.current) {
              anchorGrid.current = start;
            }

            setDraggingSelection(
              canvasMode === "animation"
                ? clampSelectionToBounds({ start, end: start }, canvasBounds)
                : { start, end: start }
            );
            dragStartGrid.current = start;
            setTextCursor(null);
            return;
          }

          if (
            canvasMode === "structured" &&
            tool !== "box" &&
            tool !== "line"
          ) {
            return;
          }

          clearInteractionState();
          dragStartGrid.current = start;
          lastGrid.current = start;
          lastPlacedGrid.current = start;
          anchorGrid.current = start;
          lineAxisRef.current = null;

          if (tool === "brush" && canvasMode !== "structured") {
            interactionModeRef.current = "drawing";
            addScratchPoints([{ ...start, char: brushChar }]);
          } else if (tool === "eraser" && canvasMode !== "structured") {
            interactionModeRef.current = "drawing";
            erasePoints([start], false);
          } else if (isShapeTool(tool, canvasMode)) {
            interactionModeRef.current = "shape-preview";
          }
        }
      },
      onDrag: ({ xy: [x, y], delta: [dx, dy], event }) => {
        if (shouldIgnoreMinimapGestureEvent(event)) return;
        if (interactionModeRef.current === "panning") {
          queueOffsetDelta(dx, dy);
          return;
        }

        const rect = containerRef.current?.getBoundingClientRect();
        if (rect && dragStartGrid.current) {
          const raw = GridManager.screenToGrid(
            x - rect.left,
            y - rect.top,
            offset.x,
            offset.y,
            zoom
          );
          const currentGrid =
            canvasMode === "animation"
              ? clampPointToBounds(GridManager.snapToCharStart(raw, grid), canvasBounds)
              : GridManager.snapToCharStart(raw, grid);

          switch (interactionModeRef.current) {
            case "selecting":
              setDraggingSelection(
                canvasMode === "animation"
                  ? clampSelectionToBounds(
                      {
                        start: dragStartGrid.current,
                        end: currentGrid,
                      },
                      canvasBounds
                    )
                  : {
                      start: dragStartGrid.current,
                      end: currentGrid,
                    }
              );
              break;
            case "drawing":
              if (tool === "brush" || tool === "eraser") {
                throttledDraw(currentGrid);
              }
              break;
            case "shape-preview":
              if (isShapeTool(tool, canvasMode)) {
                if (tool === "line" && !lineAxisRef.current) {
                  const adx = Math.abs(currentGrid.x - dragStartGrid.current.x);
                  const ady = Math.abs(currentGrid.y - dragStartGrid.current.y);
                  if (adx > 0 || ady > 0)
                    lineAxisRef.current = ady > adx ? "vertical" : "horizontal";
                }
                updateScratchForShape(tool, dragStartGrid.current, currentGrid, {
                  axis: lineAxisRef.current,
                });
              }
              break;
            default:
              break;
          }
          if (tool === "eraser") setHoveredGrid(currentGrid);
        }
      },
      onDragEnd: ({ event, xy: [x, y] }) => {
        if (shouldIgnoreMinimapGestureEvent(event)) return;
        if (interactionModeRef.current === "panning") {
          flushQueuedOffset();
          isPanningRef.current = false;
          interactionModeRef.current = "idle";
          document.body.style.cursor = "auto";
          return;
        }
        if ((event as MouseEvent).button === 0) {
          switch (interactionModeRef.current) {
            case "selecting":
              if (draggingSelection) {
                if (tool === "fill") {
                  fillArea(draggingSelection);
                } else if (tool === "select") {
                  if (
                    draggingSelection.start.x === draggingSelection.end.x &&
                    draggingSelection.start.y === draggingSelection.end.y
                  ) {
                    setTextCursor(draggingSelection.start);
                  } else {
                    addSelection(draggingSelection);
                  }
                }
                setDraggingSelection(null);
              }
              break;
            case "drawing":
              if (tool === "brush") {
                commitScratch();
              } else if (tool === "eraser") {
                forceHistorySave();
              }
              break;
            case "shape-preview":
              if (isShapeTool(tool, canvasMode) && dragStartGrid.current) {
                if (canvasMode === "structured" && (tool === "box" || tool === "line")) {
                  const endGrid =
                    resolveGridPointFromScreen(x, y) || dragStartGrid.current;
                  commitStructuredShape(tool, dragStartGrid.current, endGrid, {
                    axis: lineAxisRef.current,
                  });
                } else {
                  commitScratch();
                }
              }
              break;
            default:
              break;
          }
          resetDragState();
        }
        document.body.style.cursor = "auto";
      },
      onWheel: ({ xy: [clientX, clientY], delta: [, dy], event }) => {
        if (isFromMinimap(event)) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        if (isCtrlOrMeta(event)) {
          event.preventDefault();
          flushQueuedOffset();
          const mouseX = clientX - rect.left;
          const mouseY = clientY - rect.top;
          const zoomWeight = 0.002;
          const deltaZoom = 1 - dy * zoomWeight;
          const oldZoom = zoom;
          const nextZoom = Math.max(
            MIN_ZOOM,
            Math.min(MAX_ZOOM, oldZoom * deltaZoom)
          );

          if (nextZoom !== oldZoom) {
            setZoom(() => nextZoom);
            if (canvasMode !== "animation") {
              const actualScale = nextZoom / oldZoom;
              setOffset((prev: Point) => ({
                x: mouseX - (mouseX - prev.x) * actualScale,
                y: mouseY - (mouseY - prev.y) * actualScale,
              }));
            }
          }
        } else {
          if (canvasMode === "animation") return;
          const wheelEvent = event as WheelEvent;
          let deltaX = wheelEvent.deltaX;
          let deltaY = wheelEvent.deltaY;
          if (wheelEvent.shiftKey && deltaX === 0 && deltaY !== 0) {
            deltaX = deltaY;
            deltaY = 0;
          }
          queueOffsetDelta(-deltaX, -deltaY);
        }
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

  return { bind, draggingSelection };
};
