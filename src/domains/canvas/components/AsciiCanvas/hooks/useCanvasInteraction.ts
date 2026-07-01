import { useEffect, useRef, useState } from "react";
import { useGesture } from "@use-gesture/react";
import { useCreation, useThrottleFn } from "ahooks";
import { GridManager } from "@/shared/utils/grid";
import type { Point, SelectionArea, StructuredNode, ToolType } from "@/shared/types";
import type { CanvasState } from "@/domains/canvas/state/canvasStore";
import { forceHistorySave } from "@/shared/lib/yjs-setup";
import bresenham from "bresenham";
import { isCtrlOrMeta } from "@/shared/utils/event";
import { MIN_ZOOM, MAX_ZOOM } from "@/shared/lib/constants";
import { getCellOccupancy } from "@/shared/metrics";
import {
  clampPointToBounds,
  clampSelectionToBounds,
  isPointWithinBounds,
} from "@/domains/canvas/state/helpers/animationHelpers";
import {
  resolveCanvasLinkHit,
  type CanvasLinkHit,
} from "./linkHitTesting";
import {
  findStructuredNodeHit,
  findStructuredNodeIdsInSelection,
  getStructuredBoxNameEndPoint,
  isPointOnStructuredBoxBorder,
  moveStructuredNode,
  resizeStructuredRect,
  resizeStructuredLine,
  type StructuredBoxResizeHandle,
  type StructuredLineResizeHandle,
} from "@/domains/canvas/state/helpers/structuredBoxEditing";
import {
  getStructuredTextOffsetAtPoint,
  getStructuredTextCaretPoint,
} from "@/shared/utils/structuredTextRanges";

const isShapeTool = (tool: ToolType, canvasMode: CanvasState["canvasMode"]): boolean => {
  if (canvasMode === "structured") return tool === "box" || tool === "line" || tool === "bg";
  return ["box", "circle", "line", "stepline"].includes(tool);
};

type InteractionMode =
  | "idle"
  | "panning"
  | "selecting"
  | "drawing"
  | "shape-preview"
  | "structured-node-moving"
  | "structured-box-resizing"
  | "structured-line-resizing"
  | "structured-text-selecting";

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

const isFromCanvasUi = (event: Event | undefined) => {
  const target = event?.target;
  if (target instanceof Element && target.closest('[data-canvas-ui="true"]')) {
    return true;
  }

  const path = event?.composedPath?.() ?? [];
  return path.some(
    (entry) =>
      entry instanceof Element &&
      entry.matches('[data-canvas-ui="true"], [data-canvas-ui="true"] *')
  );
};

export const shouldOpenCanvasLink = (event: Pick<MouseEvent, "ctrlKey" | "metaKey">) =>
  event.ctrlKey || event.metaKey;

export const shouldUseCanvasLinkPointer = (
  hit: CanvasLinkHit | null,
  event: Pick<MouseEvent | KeyboardEvent, "ctrlKey" | "metaKey">
) => !!hit && shouldOpenCanvasLink(event);

const getStructuredBoxCursor = (handle: StructuredBoxResizeHandle | null) => {
  switch (handle) {
    case "n":
    case "s":
      return "ns-resize";
    case "e":
    case "w":
      return "ew-resize";
    case "nw":
    case "se":
      return "nwse-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    default:
      return "move";
  }
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
    | "structuredScene"
    | "editingStructuredTextNodeId"
    | "setSelectedStructuredNodeIds"
    | "setEditingStructuredTextNodeId"
    | "setStructuredTextSelection"
    | "updateStructuredNode"
  >,
  containerRef: React.RefObject<HTMLDivElement | null>,
  setHoveredLink: (hit: CanvasLinkHit | null) => void
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
    structuredScene,
    editingStructuredTextNodeId,
    setSelectedStructuredNodeIds,
    setEditingStructuredTextNodeId,
    setStructuredTextSelection,
    updateStructuredNode,
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

  const resolveLinkHitFromScreen = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return resolveCanvasLinkHit({
      clientX,
      clientY,
      rect,
      offset,
      zoom,
      grid,
      canvasMode,
      canvasBounds,
    });
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
  const structuredNodeDragRef = useRef<{
    node: StructuredNode;
    handle: StructuredBoxResizeHandle | StructuredLineResizeHandle | null;
  } | null>(null);
  const structuredTextSelectionStartRef = useRef<{
    nodeId: string;
    offset: number;
  } | null>(null);
  const hoveredLinkCandidateRef = useRef<CanvasLinkHit | null>(null);
  const [draggingSelection, setDraggingSelection] =
    useState<SelectionArea | null>(null);

  const updateLinkHover = (
    hit: CanvasLinkHit | null,
    event: Pick<MouseEvent | KeyboardEvent, "ctrlKey" | "metaKey">
  ) => {
    hoveredLinkCandidateRef.current = hit;
    setHoveredLink(hit);
    if (containerRef.current) {
      containerRef.current.style.cursor = shouldUseCanvasLinkPointer(hit, event) ? "pointer" : "";
    }
  };

  const resetDragState = () => {
    dragStartGrid.current = null;
    lastGrid.current = null;
    lastPlacedGrid.current = null;
    lineAxisRef.current = null;
    structuredNodeDragRef.current = null;
    structuredTextSelectionStartRef.current = null;
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
    const syncModifierState = (event: KeyboardEvent) => {
      updateLinkHover(hoveredLinkCandidateRef.current, event);
    };
    window.addEventListener("keydown", syncModifierState);
    window.addEventListener("keyup", syncModifierState);
    return () => {
      window.removeEventListener("keydown", syncModifierState);
      window.removeEventListener("keyup", syncModifierState);
    };
  }, []);

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
        const charWidth = getCellOccupancy(brushChar);
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

  const startStructuredNodeEdit = (clientX: number, clientY: number) => {
    if (canvasMode !== "structured" || tool !== "select") return false;
    const point = resolveGridPointFromScreen(clientX, clientY);
    if (!point) return false;
    const hit = findStructuredNodeHit(structuredScene, point);
    if (!hit) return false;
    if (hit.kind === "text") {
      setSelectedStructuredNodeIds([hit.node.id]);
      clearSelections();
      setTextCursor(point);
      setEditingStructuredTextNodeId(hit.node.id);
      setStructuredTextSelection(null);
      setDraggingSelection(null);
      resetDragState();
      if (containerRef.current) containerRef.current.style.cursor = "text";
      return true;
    }
    if (hit.kind !== "box" || !isPointOnStructuredBoxBorder(hit.node, point)) return false;
    const cursor = getStructuredBoxNameEndPoint(hit.node);
    if (!cursor) return false;

    setSelectedStructuredNodeIds([hit.node.id]);
    clearSelections();
    setEditingStructuredTextNodeId(null);
    setStructuredTextSelection(null);
    setTextCursor(cursor);
    setDraggingSelection(null);
    resetDragState();
    if (containerRef.current) containerRef.current.style.cursor = "text";
    return true;
  };

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
        if (isFromCanvasUi(event)) return;
        if (isFromMinimap(event)) return;
        const linkHit = resolveLinkHitFromScreen(x, y);
        updateLinkHover(linkHit, event as MouseEvent);
        if (canvasMode === "structured") {
          if (tool === "text") {
            if (containerRef.current) containerRef.current.style.cursor = "text";
            return;
          }
          if (tool === "select") {
            const point = resolveGridPointFromScreen(x, y);
            const hit = point ? findStructuredNodeHit(structuredScene, point) : null;
            if (containerRef.current) {
              containerRef.current.style.cursor = hit
                ? hit.kind === "text" &&
                  editingStructuredTextNodeId === hit.node.id
                  ? "text"
                  : hit.kind === "box" || hit.kind === "bg"
                  ? getStructuredBoxCursor(hit.handle)
                  : hit.kind === "line" && hit.handle
                    ? "crosshair"
                    : "move"
                : "";
            }
          }
          return;
        }
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
        if (isFromCanvasUi(event)) return;
        if (isFromMinimap(event)) return;
        updateLinkHover(null, event as MouseEvent);
        const mouseEvent = event as MouseEvent;
        if (canvasMode !== "animation" && tool === "pan") {
          isPanningRef.current = true;
          interactionModeRef.current = "panning";
          document.body.style.cursor = "grabbing";
          return;
        }

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

          if (canvasMode === "structured" && tool === "select") {
            const hit = findStructuredNodeHit(structuredScene, start);
            if (hit) {
              if (hit.kind === "text" && mouseEvent.detail >= 2) {
                setSelectedStructuredNodeIds([hit.node.id]);
                clearSelections();
                setDraggingSelection(null);
                resetDragState();
                if (containerRef.current) {
                  containerRef.current.style.cursor = "text";
                }
                return;
              }
              if (
                hit.kind === "text" &&
                editingStructuredTextNodeId === hit.node.id
              ) {
                const offset = getStructuredTextOffsetAtPoint(hit.node, start);
                const caretPoint = getStructuredTextCaretPoint(hit.node, offset);
                setSelectedStructuredNodeIds([hit.node.id]);
                clearSelections();
                setTextCursor(caretPoint);
                setStructuredTextSelection(null);
                structuredTextSelectionStartRef.current = {
                  nodeId: hit.node.id,
                  offset,
                };
                dragStartGrid.current = start;
                interactionModeRef.current = "structured-text-selecting";
                setDraggingSelection(null);
                if (containerRef.current) {
                  containerRef.current.style.cursor = "text";
                }
                return;
              }
              setSelectedStructuredNodeIds([hit.node.id]);
              setEditingStructuredTextNodeId(null);
              setStructuredTextSelection(null);
              structuredNodeDragRef.current = { node: hit.node, handle: hit.handle };
              dragStartGrid.current = start;
              interactionModeRef.current = (hit.kind === "box" || hit.kind === "bg") && hit.handle
                ? "structured-box-resizing"
                : hit.kind === "line" && hit.handle
                  ? "structured-line-resizing"
                  : "structured-node-moving";
              if (containerRef.current) {
                containerRef.current.style.cursor = hit.kind === "box" || hit.kind === "bg"
                  ? getStructuredBoxCursor(hit.handle)
                  : hit.kind === "line" && hit.handle
                    ? "crosshair"
                    : "move";
              }
              setTextCursor(null);
              clearSelections();
              return;
            }
            setSelectedStructuredNodeIds([]);
            setEditingStructuredTextNodeId(null);
            setStructuredTextSelection(null);
            if (containerRef.current) containerRef.current.style.cursor = "";
          }

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
            tool !== "line" &&
            tool !== "bg"
          ) {
            return;
          }

          clearInteractionState();
          setEditingStructuredTextNodeId(null);
          setStructuredTextSelection(null);
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
        if (isFromCanvasUi(event)) return;
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
            case "structured-node-moving": {
              const drag = structuredNodeDragRef.current;
              if (drag) {
                updateStructuredNode(drag.node.id, () =>
                  moveStructuredNode(drag.node, {
                    x: currentGrid.x - dragStartGrid.current!.x,
                    y: currentGrid.y - dragStartGrid.current!.y,
                  })
                );
              }
              break;
            }
            case "structured-box-resizing": {
              const drag = structuredNodeDragRef.current;
              if (
                (drag?.node.type === "box" || drag?.node.type === "bg") &&
                drag.handle
              ) {
                const node = drag.node;
                updateStructuredNode(node.id, () =>
                  resizeStructuredRect(
                    node,
                    drag.handle as StructuredBoxResizeHandle,
                    currentGrid
                  )
                );
              }
              break;
            }
            case "structured-line-resizing": {
              const drag = structuredNodeDragRef.current;
              if (drag?.node.type === "line" && drag.handle) {
                const node = drag.node;
                updateStructuredNode(node.id, () =>
                  resizeStructuredLine(
                    node,
                    drag.handle as StructuredLineResizeHandle,
                    currentGrid
                  )
                );
              }
              break;
            }
            case "structured-text-selecting": {
              const selectionStart = structuredTextSelectionStartRef.current;
              if (!selectionStart) break;
              const node = structuredScene.find(
                (sceneNode) =>
                  sceneNode.id === selectionStart.nodeId &&
                  sceneNode.type === "text"
              );
              if (!node || node.type !== "text") break;
              const focus = getStructuredTextOffsetAtPoint(node, currentGrid);
              setStructuredTextSelection({
                nodeId: node.id,
                anchor: selectionStart.offset,
                focus,
              });
              setTextCursor(getStructuredTextCaretPoint(node, focus));
              break;
            }
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
        if (isFromCanvasUi(event)) return;
        if (shouldIgnoreMinimapGestureEvent(event)) return;
        if (interactionModeRef.current === "panning") {
          flushQueuedOffset();
          isPanningRef.current = false;
          interactionModeRef.current = "idle";
          document.body.style.cursor = "auto";
          if (containerRef.current) containerRef.current.style.cursor = "";
          hoveredLinkCandidateRef.current = null;
          setHoveredLink(null);
          return;
        }
        if ((event as MouseEvent).button === 0) {
          switch (interactionModeRef.current) {
            case "selecting":
              if (draggingSelection) {
                if (tool === "fill") {
                  fillArea(draggingSelection);
                } else if (tool === "select") {
                  if (canvasMode === "structured") {
                    const selectedIds = findStructuredNodeIdsInSelection(
                      structuredScene,
                      draggingSelection
                    );
                    setSelectedStructuredNodeIds(selectedIds);
                    clearSelections();
                  } else if (
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
                if (canvasMode === "structured" && (tool === "box" || tool === "line" || tool === "bg")) {
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
      onClick: ({ event }) => {
        if (isFromCanvasUi(event)) return;
        if (isFromMinimap(event)) return;
        if (interactionModeRef.current !== "idle") return;
        const mouseEvent = event as MouseEvent;
        if (canvasMode === "structured" && tool === "text") {
          const point = resolveGridPointFromScreen(
            mouseEvent.clientX,
            mouseEvent.clientY
          );
          if (!point) return;
          event.preventDefault();
          clearSelections();
          setSelectedStructuredNodeIds([]);
          setEditingStructuredTextNodeId(null);
          setTextCursor(point);
          if (containerRef.current) containerRef.current.style.cursor = "text";
          return;
        }
        const linkHit = resolveLinkHitFromScreen(mouseEvent.clientX, mouseEvent.clientY);
        if (!linkHit) return;
        if (!shouldOpenCanvasLink(mouseEvent)) return;
        event.preventDefault();
        window.open(linkHit.href, "_blank", "noopener,noreferrer");
        setHoveredLink(linkHit);
      },
      onWheel: ({ xy: [clientX, clientY], delta: [, dy], event }) => {
        if (isFromCanvasUi(event)) return;
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

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isFromCanvasUi(event.nativeEvent)) return;
    if (isFromMinimap(event.nativeEvent)) return;
    if (startStructuredNodeEdit(event.clientX, event.clientY)) {
      event.preventDefault();
    }
  };

  return { bind, draggingSelection, handleDoubleClick };
};

