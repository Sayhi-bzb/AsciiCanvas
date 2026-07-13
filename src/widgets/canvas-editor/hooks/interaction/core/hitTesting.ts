import type {
  Point,
  StructuredNode,
  StructuredTextNode,
} from "@/shared/types";
import { gridCellRect } from "@/shared/metrics";
import {
  getStructuredNodeBounds,
  getTextColumnWidth,
} from "@/shared/utils/structured";
import {
  getStructuredTextCaretPoint,
  getStructuredTextOffsetAtPoint,
} from "@/shared/utils/structuredTextRanges";
import {
  findStructuredNodeHit,
  getStructuredSplitBoxGuides,
  getStructuredSplitBoxHandleId,
  isStructuredSplitBoxLineHandle,
  type StructuredBoxResizeHandle,
  type StructuredNodeHit,
  type StructuredSplitBoxHandle,
} from "@/domains/structured-content/public";
import type { CanvasLinkHit } from "./linkHitTesting";
import {
  getStructuredLineHandlePoints,
  getStructuredRectHandlePoints,
  getStructuredSplitBoxHandlePoints,
} from "@/domains/structured-content/public";

export const isFromMinimap = (event: Event | undefined) => {
  const target = event?.target;
  if (!(target instanceof Element)) return false;
  return !!target.closest('[data-minimap-root="true"]');
};

export const isFromCanvasUi = (event: Event | undefined) => {
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

export const shouldOpenCanvasLink = (
  event: Pick<MouseEvent, "ctrlKey" | "metaKey">
) => event.ctrlKey || event.metaKey;

export const shouldUseCanvasLinkPointer = (
  hit: CanvasLinkHit | null,
  event: Pick<MouseEvent | KeyboardEvent, "ctrlKey" | "metaKey">
) => !!hit && shouldOpenCanvasLink(event);

export const isPointInHandle = (input: {
  point: Point;
  handleCenter: Point;
  zoom: number;
}) => {
  const handleSize = Math.max(6, Math.round(7 * input.zoom));
  const half = handleSize / 2;
  return (
    input.point.x >= input.handleCenter.x - half &&
    input.point.x <= input.handleCenter.x + half &&
    input.point.y >= input.handleCenter.y - half &&
    input.point.y <= input.handleCenter.y + half
  );
};

export const findSelectedStructuredHandleHit = ({
  screenPoint,
  selectedStructuredNodeIds,
  structuredScene,
  offset,
  zoom,
}: {
  screenPoint: Point;
  selectedStructuredNodeIds: string[];
  structuredScene: StructuredNode[];
  offset: Point;
  zoom: number;
}): StructuredNodeHit | null => {
  if (selectedStructuredNodeIds.length !== 1) return null;
  const node = structuredScene.find(
    (sceneNode) => sceneNode.id === selectedStructuredNodeIds[0]
  );
  if (!node) return null;

  if (node.type === "splitBox") {
    const handle = getStructuredSplitBoxHandlePoints(node).find(({ point }) => {
      const pos = gridCellRect(point, { offset, zoom });
      return isPointInHandle({
        point: screenPoint,
        handleCenter: {
          x: pos.x + pos.width / 2,
          y: pos.y + pos.height / 2,
        },
        zoom,
      });
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
        isPointInHandle({
          point: screenPoint,
          handleCenter: {
            x: pos.x + width * xRatio,
            y: pos.y + height * yRatio,
          },
          zoom,
        })
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
        isPointInHandle({
          point: screenPoint,
          handleCenter: {
            x: pos.x + width * xRatio,
            y: pos.y + height * yRatio,
          },
          zoom,
        })
    )?.handle;
    return handle ? { node, kind: "bg", handle } : null;
  }

  if (node.type === "line") {
    const handle = getStructuredLineHandlePoints().find(({ point }) => {
      const endpoint = node[point];
      const pos = gridCellRect(endpoint, { offset, zoom });
      return isPointInHandle({
        point: screenPoint,
        handleCenter: {
          x: pos.x + pos.width / 2,
          y: pos.y + pos.height / 2,
        },
        zoom,
      });
    })?.handle;
    return handle ? { node, kind: "line", handle } : null;
  }

  return null;
};

export const stripStructuredResizeHandle = (
  hit: StructuredNodeHit | null
): StructuredNodeHit | null => {
  if (!hit) return null;
  if (hit.kind === "text") return hit;
  return { ...hit, handle: null } as StructuredNodeHit;
};

export const keepStructuredSplitLineHandle = (
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

export const getStructuredHitCursor = (
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

export const getStructuredTextLineEndX = (
  node: StructuredTextNode,
  row: number
) => {
  const line = node.text.split("\n")[row] ?? "";
  return node.position.x + getTextColumnWidth(line);
};

export const getStructuredTextCaretHit = ({
  point,
  structuredScene,
  preferredNodeId,
}: {
  point: Point;
  structuredScene: StructuredNode[];
  preferredNodeId?: string | null;
}) => {
  const textNodes = structuredScene
    .filter((node): node is StructuredTextNode => node.type === "text")
    .sort((a, b) => b.order - a.order);
  const preferredNode = preferredNodeId
    ? textNodes.find((node) => node.id === preferredNodeId)
    : null;
  const candidates = preferredNode
    ? [
        preferredNode,
        ...textNodes.filter((node) => node.id !== preferredNode.id),
      ]
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
export const resolveStructuredSelectHit = ({
  screenPoint,
  point,
  selectedStructuredNodeIds,
  structuredScene,
  offset,
  zoom,
  editingStructuredTextNodeId,
  includeCaretBehindHandle = true,
}: {
  screenPoint: Point | null;
  point: Point | null;
  selectedStructuredNodeIds: string[];
  structuredScene: StructuredNode[];
  offset: Point;
  zoom: number;
  editingStructuredTextNodeId: string | null;
  includeCaretBehindHandle?: boolean;
}) => {
  const handleHit = screenPoint
    ? findSelectedStructuredHandleHit({
        screenPoint,
        selectedStructuredNodeIds,
        structuredScene,
        offset,
        zoom,
      })
    : null;
  const caretHit =
    (!handleHit || includeCaretBehindHandle) &&
    editingStructuredTextNodeId &&
    point
      ? getStructuredTextCaretHit({
          point,
          structuredScene,
          preferredNodeId: editingStructuredTextNodeId,
        })
      : null;
  const nodeHit = keepStructuredSplitLineHandle(
    point ? findStructuredNodeHit(structuredScene, point) : null
  );
  const hit = handleHit ?? caretHit?.hit ?? nodeHit ?? null;

  return {
    hit,
    caretHit,
    cursor: hit ? getStructuredHitCursor(hit, editingStructuredTextNodeId) : "",
  };
};

export const resolveStructuredSelectHover = resolveStructuredSelectHit;


