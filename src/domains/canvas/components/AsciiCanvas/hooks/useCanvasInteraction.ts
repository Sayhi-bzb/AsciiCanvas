import { useEffect, useRef, useState } from "react";
import { useGesture } from "@use-gesture/react";
import { useCreation, useThrottleFn } from "ahooks";
import { GridManager } from "@/shared/utils/grid";
import type {
  GridCell,
  Point,
  SelectionArea,
  StructuredNode,
  StructuredTextNode,
  ToolType,
} from "@/shared/types";
import type { CanvasState } from "@/domains/canvas/state/canvasStore";
import { forceHistorySave } from "@/shared/lib/yjs-setup";
import bresenham from "bresenham";
import { isCtrlOrMeta } from "@/shared/utils/event";
import { MIN_ZOOM, MAX_ZOOM } from "@/shared/lib/constants";
import { getCellOccupancy, gridCellRect } from "@/shared/metrics";
import {
  getStructuredNodeBounds,
  getTextColumnWidth,
  sceneToGridEntries,
} from "@/shared/utils/structured";
import { getSplitBoxPoints } from "@/shared/utils/shapes";
import { createMapFromEntries } from "@/domains/canvas/state/helpers/snapshotHelpers";
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
  resizeStructuredSplitBox,
  getStructuredSplitBoxGuides,
  getStructuredSplitBoxHandleId,
  isStructuredSplitBoxLineHandle,
  type StructuredBoxResizeHandle,
  type StructuredLineResizeHandle,
  type StructuredSplitBoxHandle,
  type StructuredNodeHit,
} from "@/domains/canvas/state/helpers/structuredBoxEditing";
import {
  getStructuredTextOffsetAtPoint,
  getStructuredTextCaretPoint,
} from "@/shared/utils/structuredTextRanges";
import {
  getStructuredLineHandlePoints,
  getStructuredRectHandlePoints,
  getStructuredSplitBoxHandlePoints,
  type StructuredMovePreview,
} from "./useCanvasRenderer";

const isShapeTool = (tool: ToolType, canvasMode: CanvasState["canvasMode"]): boolean => {
  if (canvasMode === "structured") return tool === "box" || tool === "splitBox" || tool === "line" || tool === "bg";
  return ["box", "circle", "line", "stepline", "bg"].includes(tool);
};

const getStructuredTextLineEndX = (node: StructuredTextNode, row: number) => {
  const line = node.text.split("\n")[row] ?? "";
  return node.position.x + getTextColumnWidth(line);
};

type InteractionMode =
  | "idle"
  | "panning"
  | "selecting"
  | "drawing"
  | "shape-preview"
  | "structured-node-moving"
  | "structured-box-resizing"
  | "structured-splitbox-resize-pending"
  | "structured-splitbox-resizing"
  | "structured-line-resizing"
  | "structured-text-selecting";

const isSelectionTool = (
  tool: ToolType,
  canvasMode: CanvasState["canvasMode"]
) => {
  if (canvasMode === "structured") return tool === "select";
  return tool === "select" || tool === "fill";
};

const createStructuredSplitBoxGrid = (
  node: Extract<StructuredNode, { type: "splitBox" }>
) => {
  const grid = new Map<string, GridCell>();
  getSplitBoxPoints(node.start, node.end, {
    verticalSplitRatio: node.verticalSplitRatio,
    topSplitRatio: node.topSplitRatio,
    bottomSplitRatio: node.bottomSplitRatio,
    root: node.root,
  }).forEach((point) => {
    grid.set(GridManager.toKey(point.x, point.y), {
      char: point.char,
      color: node.style.color,
      bgColor: node.style.bgColor,
      attrs: node.style.attrs,
    });
  });
  return grid;
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

const getStructuredSplitBoxCursor = (
  node: Extract<StructuredNode, { type: "splitBox" }>,
  handle: StructuredSplitBoxHandle | null
) => {
  if (handle && isStructuredSplitBoxLineHandle(handle)) {
    const splitId = getStructuredSplitBoxHandleId(handle);
    const split = getStructuredSplitBoxGuides(node).handles.find(
      (candidate) => candidate.id === splitId
    );
    return split?.axis === "vertical" ? "ew-resize" : "ns-resize";
  }
  return getStructuredBoxCursor(handle);
};

const stripStructuredResizeHandle = (
  hit: StructuredNodeHit | null
): StructuredNodeHit | null => {
  if (!hit) return null;
  if (hit.kind === "text") return hit;
  return { ...hit, handle: null } as StructuredNodeHit;
};

const keepStructuredSplitLineHandle = (
  hit: StructuredNodeHit | null
): StructuredNodeHit | null => {
  if (
    hit?.kind === "splitBox" &&
    hit.handle &&
    isStructuredSplitBoxLineHandle(hit.handle)
  ) {
    return hit;
  }
  return stripStructuredResizeHandle(hit);
};

const getStructuredHitCursor = (
  hit: StructuredNodeHit,
  editingTextNodeId: string | null
) => {
  switch (hit.kind) {
    case "text":
      return editingTextNodeId === hit.node.id ? "text" : "move";
    case "splitBox":
      return getStructuredSplitBoxCursor(hit.node, hit.handle);
    case "box":
    case "bg":
      return getStructuredBoxCursor(hit.handle);
    case "line":
      return hit.handle ? "crosshair" : "move";
  }
};

const getCellPickedColor = (
  cell: GridCell | undefined,
  target: CanvasState["canvasColorPickerTarget"]
) => {
  if (!cell || !target) return null;
  if (target === "bg") return cell.bgColor ?? null;
  return cell.char.trim() ? cell.color : null;
};

export const useCanvasInteraction = (
  store: Pick<
    CanvasState,
    | "tool"
    | "brushChar"
    | "brushColor"
    | "setBrushColor"
    | "canvasColorPickerTarget"
    | "setCanvasColorPickerTarget"
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
    | "selectedStructuredNodeIds"
    | "setStructuredGridFocus"
    | "setStructuredContextPoint"
    | "setSelectedStructuredNodeIds"
    | "setSelectedStructuredSplitHandle"
    | "setEditingStructuredTextNodeId"
    | "setStructuredTextSelection"
    | "structuredTextSelection"
    | "setStructuredTextColor"
    | "applyStructuredScene"
    | "updateStructuredNode"
  >,
  containerRef: React.RefObject<HTMLDivElement | null>,
  setHoveredLink: (hit: CanvasLinkHit | null) => void,
  structuredMovePreviewRef?: React.MutableRefObject<StructuredMovePreview | null>,
  requestRenderRef?: React.MutableRefObject<(() => void) | null>
) => {
  const {
    tool,
    brushChar,
    setBrushColor,
    canvasColorPickerTarget,
    setCanvasColorPickerTarget,
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
    selectedStructuredNodeIds,
    setStructuredGridFocus,
    setStructuredContextPoint,
    setSelectedStructuredNodeIds,
    setSelectedStructuredSplitHandle,
    setEditingStructuredTextNodeId,
    setStructuredTextSelection,
    structuredTextSelection,
    setStructuredTextColor,
    applyStructuredScene,
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

  const getLocalScreenPoint = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const isPointInHandle = (point: Point, x: number, y: number) => {
    const handleSize = Math.max(6, Math.round(7 * zoom));
    const half = handleSize / 2;
    return (
      point.x >= x - half &&
      point.x <= x + half &&
      point.y >= y - half &&
      point.y <= y + half
    );
  };

  const findSelectedStructuredHandleHit = (
    screenPoint: Point
  ): StructuredNodeHit | null => {
    if (selectedStructuredNodeIds.length !== 1) return null;
    const node = structuredScene.find(
      (sceneNode) => sceneNode.id === selectedStructuredNodeIds[0]
    );
    if (!node) return null;

    if (node.type === "splitBox") {
      const handle = getStructuredSplitBoxHandlePoints(node).find(({ point }) => {
        const pos = gridCellRect(point, { offset, zoom });
        return isPointInHandle(
          screenPoint,
          pos.x + pos.width / 2,
          pos.y + pos.height / 2
        );
      })?.handle;
      return handle ? { node, kind: "splitBox", handle } : null;
    }

    if (node.type === "box") {
      const bounds = getStructuredNodeBounds(node);
      const pos = gridCellRect({ x: bounds.x, y: bounds.y }, { offset, zoom });
      const width = bounds.width * pos.width;
      const height = bounds.height * pos.height;
      const handle = getStructuredRectHandlePoints(bounds).find(
        ({ xRatio, yRatio }) =>
          isPointInHandle(
            screenPoint,
            pos.x + width * xRatio,
            pos.y + height * yRatio
          )
      )?.handle;
      return handle ? { node, kind: "box", handle } : null;
    }

    if (node.type === "bg") {
      const bounds = getStructuredNodeBounds(node);
      const pos = gridCellRect({ x: bounds.x, y: bounds.y }, { offset, zoom });
      const width = bounds.width * pos.width;
      const height = bounds.height * pos.height;
      const handle = getStructuredRectHandlePoints(bounds).find(
        ({ xRatio, yRatio }) =>
          isPointInHandle(
            screenPoint,
            pos.x + width * xRatio,
            pos.y + height * yRatio
          )
      )?.handle;
      return handle ? { node, kind: "bg", handle } : null;
    }

    if (node.type === "line") {
      const handle = getStructuredLineHandlePoints().find(({ point }) => {
        const endpoint = node[point];
        const pos = gridCellRect(endpoint, { offset, zoom });
        return isPointInHandle(
          screenPoint,
          pos.x + pos.width / 2,
          pos.y + pos.height / 2
        );
      })?.handle;
      return handle ? { node, kind: "line", handle } : null;
    }

    return null;
  };

  const dragStartGrid = useRef<Point | null>(null);
  const lastGrid = useRef<Point | null>(null);
  const lastPlacedGrid = useRef<Point | null>(null);
  const anchorGrid = useRef<Point | null>(null);

  const isPanningRef = useRef(false);
  const queuedOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const queuedOffsetRafRef = useRef<number | null>(null);
  const queuedZoomRef = useRef<{
    deltaZoom: number;
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const queuedZoomRafRef = useRef<number | null>(null);
  const interactionModeRef = useRef<InteractionMode>("idle");
  const lineAxisRef = useRef<"vertical" | "horizontal" | null>(null);
  const structuredNodeDragRef = useRef<{
    node: StructuredNode;
    selectedIds: string[];
    selectedNodes: StructuredNode[];
    baseScene: StructuredNode[];
    baseGrid: ReturnType<typeof createMapFromEntries>;
    handle: StructuredBoxResizeHandle | StructuredSplitBoxHandle | StructuredLineResizeHandle | null;
  } | null>(null);
  const queuedStructuredMoveRef = useRef<{
    drag: NonNullable<typeof structuredNodeDragRef.current>;
    delta: Point;
    scene: StructuredNode[];
  } | null>(null);
  const lastStructuredMoveRef = useRef<{
    drag: NonNullable<typeof structuredNodeDragRef.current>;
    delta: Point;
    scene: StructuredNode[];
  } | null>(null);
  const queuedStructuredMoveRafRef = useRef<number | null>(null);
  const queuedStructuredSplitBoxResizeRef = useRef<{
    drag: NonNullable<typeof structuredNodeDragRef.current>;
    point: Point;
    scene: StructuredNode[];
  } | null>(null);
  const lastStructuredSplitBoxResizeRef = useRef<{
    drag: NonNullable<typeof structuredNodeDragRef.current>;
    point: Point;
    scene: StructuredNode[];
  } | null>(null);
  const queuedStructuredSplitBoxResizeRafRef = useRef<number | null>(null);
  const structuredTextSelectionStartRef = useRef<{
    nodeId: string;
    offset: number;
  } | null>(null);
  const hoveredLinkCandidateRef = useRef<CanvasLinkHit | null>(null);
  const colorPickerClickRef = useRef(false);
  const draggingSelectionRef = useRef<SelectionArea | null>(null);
  const draggingSelectionRafRef = useRef<number | null>(null);
  const fallbackStructuredMovePreviewRef =
    useRef<StructuredMovePreview | null>(null);
  const fallbackRequestRenderRef = useRef<(() => void) | null>(null);
  const activeStructuredMovePreviewRef =
    structuredMovePreviewRef ?? fallbackStructuredMovePreviewRef;
  const activeRequestRenderRef = requestRenderRef ?? fallbackRequestRenderRef;
  const [draggingSelection, setDraggingSelectionState] =
    useState<SelectionArea | null>(null);

  const clearStructuredMovePreview = () => {
    if (!activeStructuredMovePreviewRef.current) return;
    activeStructuredMovePreviewRef.current = null;
    activeRequestRenderRef.current?.();
  };

  const setStructuredMovePreview = (preview: StructuredMovePreview) => {
    activeStructuredMovePreviewRef.current = preview;
    activeRequestRenderRef.current?.();
  };

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
    lastStructuredMoveRef.current = null;
    lastStructuredSplitBoxResizeRef.current = null;
    clearStructuredMovePreview();
    structuredTextSelectionStartRef.current = null;
    interactionModeRef.current = "idle";
  };

  const pickCanvasCellColor = (point: Point) => {
    const target = canvasColorPickerTarget;
    if (!target) return false;
    const color = getCellPickedColor(
      grid.get(GridManager.toKey(point.x, point.y)),
      target
    );
    if (color) {
      setBrushColor(color);
      if (
        target === "char" &&
        canvasMode === "structured" &&
        structuredTextSelection
      ) {
        setStructuredTextColor(color);
      }
    }
    setCanvasColorPickerTarget(null);
    setHoveredGrid(null);
    return true;
  };

  const updateCanvasColorPickerHover = (clientX: number, clientY: number) => {
    const point = resolveGridPointFromScreen(clientX, clientY);
    setHoveredGrid(point);
    if (containerRef.current) containerRef.current.style.cursor = "crosshair";
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

  const flushDraggingSelection = () => {
    if (draggingSelectionRafRef.current !== null) {
      window.cancelAnimationFrame(draggingSelectionRafRef.current);
      draggingSelectionRafRef.current = null;
    }
    setDraggingSelectionState(draggingSelectionRef.current);
  };

  const setDraggingSelection = (
    selection: SelectionArea | null,
    options: { immediate?: boolean } = {}
  ) => {
    draggingSelectionRef.current = selection;
    if (options.immediate) {
      flushDraggingSelection();
      return;
    }
    if (draggingSelectionRafRef.current !== null) return;
    draggingSelectionRafRef.current = window.requestAnimationFrame(() => {
      draggingSelectionRafRef.current = null;
      setDraggingSelectionState(draggingSelectionRef.current);
    });
  };

  const flushQueuedZoom = () => {
    if (queuedZoomRafRef.current !== null) {
      window.cancelAnimationFrame(queuedZoomRafRef.current);
      queuedZoomRafRef.current = null;
    }
    const queued = queuedZoomRef.current;
    if (!queued) return;
    queuedZoomRef.current = null;

    setZoom((currentZoom: number) => {
      const nextZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, currentZoom * queued.deltaZoom)
      );
      if (nextZoom === currentZoom) return currentZoom;
      if (canvasMode !== "animation") {
        const actualScale = nextZoom / currentZoom;
        setOffset((prev: Point) => ({
          x: queued.mouseX - (queued.mouseX - prev.x) * actualScale,
          y: queued.mouseY - (queued.mouseY - prev.y) * actualScale,
        }));
      }
      return nextZoom;
    });
  };

  const queueZoomDelta = (deltaZoom: number, mouseX: number, mouseY: number) => {
    if (deltaZoom <= 0 || deltaZoom === 1) return;
    queuedZoomRef.current = queuedZoomRef.current
      ? {
          deltaZoom: queuedZoomRef.current.deltaZoom * deltaZoom,
          mouseX,
          mouseY,
        }
      : { deltaZoom, mouseX, mouseY };
    if (queuedZoomRafRef.current !== null) return;
    queuedZoomRafRef.current = window.requestAnimationFrame(() => {
      queuedZoomRafRef.current = null;
      flushQueuedZoom();
    });
  };

  const flushQueuedStructuredMove = (commit = false) => {
    if (queuedStructuredMoveRafRef.current !== null) {
      window.cancelAnimationFrame(queuedStructuredMoveRafRef.current);
      queuedStructuredMoveRafRef.current = null;
    }
    const queued = queuedStructuredMoveRef.current ?? (commit ? lastStructuredMoveRef.current : null);
    if (!queued) return;
    queuedStructuredMoveRef.current = null;
    lastStructuredMoveRef.current = queued;
    const movingNodes = new Map(
      queued.drag.selectedNodes.map((node) => [
        node.id,
        moveStructuredNode(node, queued.delta),
      ])
    );
    if (commit) {
      const nextScene = queued.scene.map((node) => movingNodes.get(node.id) ?? node);
      applyStructuredScene(nextScene, true);
      clearStructuredMovePreview();
    } else {
      const movingScene = Array.from(movingNodes.values());
      setStructuredMovePreview({
        baseScene: queued.drag.baseScene,
        movingNodes: movingScene,
        baseGrid: queued.drag.baseGrid,
        movingGrid: createMapFromEntries(sceneToGridEntries(movingScene)),
      });
    }
  };

  const queueStructuredMove = (
    drag: NonNullable<typeof structuredNodeDragRef.current>,
    delta: Point,
    scene: StructuredNode[]
  ) => {
    queuedStructuredMoveRef.current = { drag, delta, scene };
    lastStructuredMoveRef.current = queuedStructuredMoveRef.current;
    if (queuedStructuredMoveRafRef.current !== null) return;
    queuedStructuredMoveRafRef.current = window.requestAnimationFrame(() => {
      queuedStructuredMoveRafRef.current = null;
      flushQueuedStructuredMove();
    });
  };

  const flushQueuedStructuredSplitBoxResize = (commit = false) => {
    if (queuedStructuredSplitBoxResizeRafRef.current !== null) {
      window.cancelAnimationFrame(queuedStructuredSplitBoxResizeRafRef.current);
      queuedStructuredSplitBoxResizeRafRef.current = null;
    }
    const queued =
      queuedStructuredSplitBoxResizeRef.current ??
      (commit ? lastStructuredSplitBoxResizeRef.current : null);
    if (!queued) return;
    queuedStructuredSplitBoxResizeRef.current = null;
    lastStructuredSplitBoxResizeRef.current = queued;
    const { drag, point, scene } = queued;
    if (drag.node.type !== "splitBox" || !drag.handle) return;

    const resizedNode = resizeStructuredSplitBox(
      drag.node,
      drag.handle as StructuredSplitBoxHandle,
      point
    );

    if (commit) {
      const nextScene = scene.map((node) =>
        node.id === resizedNode.id ? resizedNode : node
      );
      applyStructuredScene(nextScene, true);
      clearStructuredMovePreview();
      return;
    }

    setStructuredMovePreview({
      baseScene: drag.baseScene,
      movingNodes: [resizedNode],
      baseGrid: drag.baseGrid,
      movingGrid: createStructuredSplitBoxGrid(resizedNode),
    });
  };

  const queueStructuredSplitBoxResize = (
    drag: NonNullable<typeof structuredNodeDragRef.current>,
    point: Point,
    scene: StructuredNode[]
  ) => {
    queuedStructuredSplitBoxResizeRef.current = { drag, point, scene };
    lastStructuredSplitBoxResizeRef.current = queuedStructuredSplitBoxResizeRef.current;
    if (queuedStructuredSplitBoxResizeRafRef.current !== null) return;
    queuedStructuredSplitBoxResizeRafRef.current = window.requestAnimationFrame(() => {
      queuedStructuredSplitBoxResizeRafRef.current = null;
      flushQueuedStructuredSplitBoxResize();
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
      if (queuedZoomRafRef.current !== null) {
        window.cancelAnimationFrame(queuedZoomRafRef.current);
      }
      if (queuedStructuredSplitBoxResizeRafRef.current !== null) {
        window.cancelAnimationFrame(queuedStructuredSplitBoxResizeRafRef.current);
      }
      if (draggingSelectionRafRef.current !== null) {
        window.cancelAnimationFrame(draggingSelectionRafRef.current);
      }
      if (queuedStructuredMoveRafRef.current !== null) {
        window.cancelAnimationFrame(queuedStructuredMoveRafRef.current);
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

  const getStructuredTextCaretHit = (
    point: Point,
    preferredNodeId?: string | null
  ) => {
    const textNodes = structuredScene
      .filter((node): node is StructuredTextNode => node.type === "text")
      .sort((a, b) => b.order - a.order);
    const preferredNode = preferredNodeId
      ? textNodes.find((node) => node.id === preferredNodeId)
      : null;
    const candidates = preferredNode
      ? [preferredNode, ...textNodes.filter((node) => node.id !== preferredNode.id)]
      : textNodes;

    for (const node of candidates) {
      const lines = node.text.split("\n");
      const row = point.y - node.position.y;
      if (row < 0 || row >= lines.length) continue;
      const lineEndX = getStructuredTextLineEndX(node, row);
      if (point.x < node.position.x || point.x > lineEndX + 1) continue;
      const offset = getStructuredTextOffsetAtPoint(node, point);
      return {
        hit: { node, kind: "text", handle: null } as StructuredNodeHit,
        offset,
        caretPoint: getStructuredTextCaretPoint(node, offset),
      };
    }

    return null;
  };

  const beginStructuredTextCaretSelection = (
    node: StructuredTextNode,
    point: Point,
    caretHit?: ReturnType<typeof getStructuredTextCaretHit> | null
  ) => {
    const offset =
      caretHit?.offset ?? getStructuredTextOffsetAtPoint(node, point);
    const caretPoint =
      caretHit?.caretPoint ?? getStructuredTextCaretPoint(node, offset);
    setSelectedStructuredNodeIds([node.id]);
    setSelectedStructuredSplitHandle(null);
    clearSelections();
    setTextCursor(caretPoint);
    setStructuredTextSelection(null);
    structuredTextSelectionStartRef.current = {
      nodeId: node.id,
      offset,
    };
    dragStartGrid.current = point;
    interactionModeRef.current = "structured-text-selecting";
    setDraggingSelection(null);
    if (containerRef.current) {
      containerRef.current.style.cursor = "text";
    }
  };

  const startStructuredNodeEdit = (clientX: number, clientY: number) => {
    if (canvasMode !== "structured" || tool !== "select") return false;
    const point = resolveGridPointFromScreen(clientX, clientY);
    if (!point) return false;
    const caretHit = getStructuredTextCaretHit(
      point,
      editingStructuredTextNodeId
    );
    const hit =
      caretHit?.hit ??
      findStructuredNodeHit(structuredScene, point, selectedStructuredNodeIds);
    if (!hit) return false;
    if (hit.kind === "text") {
      const textCaretHit =
        caretHit?.hit.node.id === hit.node.id
          ? caretHit
          : getStructuredTextCaretHit(point, hit.node.id);
      setSelectedStructuredNodeIds([hit.node.id]);
      setSelectedStructuredSplitHandle(null);
      clearSelections();
      setTextCursor(textCaretHit?.caretPoint ?? point);
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
    setSelectedStructuredSplitHandle(null);
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
        if (canvasColorPickerTarget) {
          updateCanvasColorPickerHover(x, y);
          return;
        }
        const linkHit = resolveLinkHitFromScreen(x, y);
        updateLinkHover(linkHit, event as MouseEvent);
        if (canvasMode === "structured") {
          if (tool === "text") {
            if (containerRef.current) containerRef.current.style.cursor = "text";
            return;
          }
          if (isShapeTool(tool, canvasMode)) {
            const point = resolveGridPointFromScreen(x, y);
            setHoveredGrid(point);
            if (containerRef.current) {
              containerRef.current.style.cursor = "crosshair";
            }
            return;
          }
          if (tool === "select") {
            const screenPoint = getLocalScreenPoint(x, y);
            const point = resolveGridPointFromScreen(x, y);
            const caretHit =
              editingStructuredTextNodeId && point
                ? getStructuredTextCaretHit(point, editingStructuredTextNodeId)
                : null;
            const hit =
              (screenPoint
                ? findSelectedStructuredHandleHit(screenPoint)
                : null) ??
              caretHit?.hit ??
              keepStructuredSplitLineHandle(
                point ? findStructuredNodeHit(structuredScene, point) : null
            );
            if (containerRef.current) {
              containerRef.current.style.cursor = hit
                ? getStructuredHitCursor(hit, editingStructuredTextNodeId)
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
        if (canvasColorPickerTarget && mouseEvent.button === 0) {
          const point = resolveGridPointFromScreen(x, y);
          if (point) {
            event.preventDefault();
            colorPickerClickRef.current = true;
            pickCanvasCellColor(point);
            resetDragState();
            if (containerRef.current) containerRef.current.style.cursor = "";
          }
          return;
        }
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
            const screenPoint = getLocalScreenPoint(x, y);
            const handleHit = screenPoint
              ? findSelectedStructuredHandleHit(screenPoint)
              : null;
            const caretHit =
              !handleHit && editingStructuredTextNodeId
                ? getStructuredTextCaretHit(start, editingStructuredTextNodeId)
                : null;
            const nodeHit = keepStructuredSplitLineHandle(
              findStructuredNodeHit(structuredScene, start)
            );
            const hit = handleHit ?? caretHit?.hit ?? nodeHit ?? null;
            if (hit) {
              if (hit.kind === "text" && mouseEvent.detail >= 2) {
                setSelectedStructuredNodeIds([hit.node.id]);
                setSelectedStructuredSplitHandle(null);
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
                beginStructuredTextCaretSelection(hit.node, start, caretHit);
                return;
              }
              const isRectResize =
                (hit.kind === "box" || hit.kind === "bg") && !!hit.handle;
              const isSplitDividerResize =
                hit.kind === "splitBox" &&
                !!hit.handle &&
                isStructuredSplitBoxLineHandle(hit.handle);
              const isSplitBoxResize = hit.kind === "splitBox" && !!hit.handle;
              const isLineResize = hit.kind === "line" && !!hit.handle;
              const shouldMoveSelection =
                !isRectResize &&
                !isSplitBoxResize &&
                !isLineResize &&
                selectedStructuredNodeIds.includes(hit.node.id);
              const dragSelectedIds = shouldMoveSelection
                ? [...selectedStructuredNodeIds]
                : [hit.node.id];
              const dragSelectedIdSet = new Set(dragSelectedIds);
              const dragSelectedNodes = structuredScene.filter((node) =>
                dragSelectedIdSet.has(node.id)
              );
              const dragBaseScene = structuredScene.filter(
                (node) => !dragSelectedIdSet.has(node.id)
              );

              setSelectedStructuredNodeIds(dragSelectedIds);
              setStructuredContextPoint(hit.kind === "splitBox" ? start : null);
              setSelectedStructuredSplitHandle(
                hit.kind === "splitBox" &&
                  hit.handle &&
                  isStructuredSplitBoxLineHandle(hit.handle)
                  ? { nodeId: hit.node.id, handle: hit.handle }
                  : null
              );
              setEditingStructuredTextNodeId(null);
              setStructuredTextSelection(null);
              structuredNodeDragRef.current = {
                node: hit.node,
                selectedIds: dragSelectedIds,
                selectedNodes:
                  dragSelectedNodes.length > 0 ? dragSelectedNodes : [hit.node],
                baseScene: dragBaseScene,
                baseGrid: createMapFromEntries(sceneToGridEntries(dragBaseScene)),
                handle: hit.handle,
              };
              dragStartGrid.current = start;
              interactionModeRef.current = isSplitDividerResize
                ? "structured-splitbox-resize-pending"
                : isSplitBoxResize
                  ? "structured-splitbox-resizing"
                  : isRectResize
                  ? "structured-box-resizing"
                  : isLineResize
                    ? "structured-line-resizing"
                  : "structured-node-moving";
              if (containerRef.current) {
                containerRef.current.style.cursor = getStructuredHitCursor(
                  hit,
                  editingStructuredTextNodeId
                );
              }
              setTextCursor(null);
              clearSelections();
              return;
            }
            setSelectedStructuredNodeIds([]);
            setSelectedStructuredSplitHandle(null);
            setStructuredContextPoint(null);
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
            tool !== "splitBox" &&
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
                const delta = {
                  x: currentGrid.x - dragStartGrid.current!.x,
                  y: currentGrid.y - dragStartGrid.current!.y,
                };
                queueStructuredMove(drag, delta, structuredScene);
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
                  ),
                  "merge"
                );
              }
              break;
            }
            case "structured-splitbox-resize-pending": {
              const drag = structuredNodeDragRef.current;
              if (
                !dragStartGrid.current ||
                currentGrid.x === dragStartGrid.current.x &&
                  currentGrid.y === dragStartGrid.current.y
              ) {
                break;
              }
              interactionModeRef.current = "structured-splitbox-resizing";
              if (drag?.node.type === "splitBox" && drag.handle) {
                queueStructuredSplitBoxResize(drag, currentGrid, structuredScene);
              }
              break;
            }
            case "structured-splitbox-resizing": {
              const drag = structuredNodeDragRef.current;
              if (drag?.node.type === "splitBox" && drag.handle) {
                const splitHandle = drag.handle as StructuredSplitBoxHandle;
                if (isStructuredSplitBoxLineHandle(splitHandle)) {
                  queueStructuredSplitBoxResize(drag, currentGrid, structuredScene);
                  break;
                }
                const node = drag.node;
                updateStructuredNode(node.id, () =>
                  resizeStructuredSplitBox(
                    node,
                    drag.handle as StructuredSplitBoxHandle,
                    currentGrid
                  ),
                  "merge"
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
                  ),
                  "merge"
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
              flushDraggingSelection();
              if (draggingSelectionRef.current) {
                if (tool === "fill") {
                  fillArea(draggingSelectionRef.current);
                } else if (tool === "select") {
                  if (canvasMode === "structured") {
                    const selectedIds = findStructuredNodeIdsInSelection(
                      structuredScene,
                      draggingSelectionRef.current
                    );
                    if (selectedIds.length > 0) {
                      setSelectedStructuredNodeIds(selectedIds);
                      setSelectedStructuredSplitHandle(null);
                    } else {
                      setStructuredGridFocus(draggingSelectionRef.current.start);
                    }
                    clearSelections();
                  } else if (
                    draggingSelectionRef.current.start.x ===
                      draggingSelectionRef.current.end.x &&
                    draggingSelectionRef.current.start.y ===
                      draggingSelectionRef.current.end.y
                  ) {
                    setTextCursor(draggingSelectionRef.current.start);
                  } else {
                    addSelection(draggingSelectionRef.current);
                  }
                }
                setDraggingSelection(null, { immediate: true });
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
                if (
                  canvasMode === "structured" &&
                  (tool === "box" || tool === "splitBox" || tool === "line" || tool === "bg")
                ) {
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
            case "structured-node-moving":
              flushQueuedStructuredMove(true);
              break;
            case "structured-box-resizing":
            case "structured-line-resizing":
              forceHistorySave();
              break;
            case "structured-splitbox-resizing": {
              const drag = structuredNodeDragRef.current;
              if (
                drag?.node.type === "splitBox" &&
                drag.handle &&
                isStructuredSplitBoxLineHandle(drag.handle as StructuredSplitBoxHandle)
              ) {
                flushQueuedStructuredSplitBoxResize(true);
              } else {
                forceHistorySave();
              }
              break;
            }
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
        if (colorPickerClickRef.current) {
          colorPickerClickRef.current = false;
          event.preventDefault();
          return;
        }
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
          setSelectedStructuredSplitHandle(null);
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
          queueZoomDelta(deltaZoom, mouseX, mouseY);
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

