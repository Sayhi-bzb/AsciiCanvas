import type { NodeBounds, Point, SelectionArea, StructuredBgNode, StructuredBoxNode, StructuredLineNode, StructuredNode, StructuredTextNode } from "@/shared/types";
import { getTextCellWidth } from "@/shared/metrics";
import { getSelectionBounds } from "@/shared/utils/selection";
import { getLShapeLinePoints } from "@/shared/utils/shapes";
import { getStructuredNodeBounds, intersectsBounds, trimTextToColumns, withPointWithinBounds } from "@/shared/utils/structured";

export type StructuredBoxResizeHandle =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w";

export type StructuredLineResizeHandle = "start" | "end";

export type StructuredBoxHit = {
  node: StructuredBoxNode;
  handle: StructuredBoxResizeHandle | null;
};

export type StructuredNodeHit =
  | { node: StructuredBoxNode; kind: "box"; handle: StructuredBoxResizeHandle | null }
  | { node: StructuredLineNode; kind: "line"; handle: StructuredLineResizeHandle | null }
  | { node: StructuredBgNode; kind: "bg"; handle: StructuredBoxResizeHandle | null }
  | { node: StructuredTextNode; kind: "text"; handle: null };

const isBoxNode = (node: StructuredNode): node is StructuredBoxNode =>
  node.type === "box";

const isPointEqual = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

type StructuredRectNode = StructuredBoxNode | StructuredBgNode;

export const getStructuredBoxBounds = (node: StructuredBoxNode): NodeBounds =>
  getStructuredNodeBounds(node);

export const getStructuredBoxNameCapacity = (node: StructuredBoxNode) =>
  Math.max(0, getStructuredBoxBounds(node).width - 5);

export const getStructuredBoxNameStartPoint = (
  node: StructuredBoxNode
): Point | null => {
  if (getStructuredBoxNameCapacity(node) <= 0) return null;
  const bounds = getStructuredBoxBounds(node);
  return { x: bounds.x + 3, y: bounds.y };
};

export const getStructuredBoxNameEndPoint = (
  node: StructuredBoxNode
): Point | null => {
  const start = getStructuredBoxNameStartPoint(node);
  if (!start) return null;
  const visibleName = trimTextToColumns(
    node.name ?? "",
    getStructuredBoxNameCapacity(node)
  );
  return {
    x: start.x + getTextCellWidth(visibleName),
    y: start.y,
  };
};

export const isPointOnStructuredBoxBorder = (
  node: StructuredBoxNode,
  point: Point
) => {
  const bounds = getStructuredBoxBounds(node);
  const left = bounds.x;
  const right = bounds.x + bounds.width - 1;
  const top = bounds.y;
  const bottom = bounds.y + bounds.height - 1;
  return (
    point.x >= left &&
    point.x <= right &&
    point.y >= top &&
    point.y <= bottom &&
    (point.x === left || point.x === right || point.y === top || point.y === bottom)
  );
};

export const getStructuredBoxHandleAtPoint = (
  node: StructuredRectNode,
  point: Point
): StructuredBoxResizeHandle | null => {
  const bounds = getStructuredNodeBounds(node);
  const left = bounds.x;
  const right = bounds.x + bounds.width - 1;
  const top = bounds.y;
  const bottom = bounds.y + bounds.height - 1;
  const onLeft = point.x === left;
  const onRight = point.x === right;
  const onTop = point.y === top;
  const onBottom = point.y === bottom;

  if (onLeft && onTop) return "nw";
  if (onRight && onTop) return "ne";
  if (onRight && onBottom) return "se";
  if (onLeft && onBottom) return "sw";
  if (onTop && point.x >= left && point.x <= right) return "n";
  if (onRight && point.y >= top && point.y <= bottom) return "e";
  if (onBottom && point.x >= left && point.x <= right) return "s";
  if (onLeft && point.y >= top && point.y <= bottom) return "w";
  return null;
};

export const isPointInsideStructuredBox = (
  node: StructuredBoxNode,
  point: Point
) => {
  const bounds = getStructuredBoxBounds(node);
  return (
    point.x >= bounds.x &&
    point.x < bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y < bounds.y + bounds.height
  );
};

const getStructuredLineHandleAtPoint = (
  node: StructuredLineNode,
  point: Point
): StructuredLineResizeHandle | null => {
  if (isPointEqual(point, node.start)) return "start";
  if (isPointEqual(point, node.end)) return "end";
  return null;
};

const isPointOnStructuredLine = (node: StructuredLineNode, point: Point) => {
  const points = getLShapeLinePoints(node.start, node.end, node.axis === "vertical");
  return points.some((linePoint) => isPointEqual(linePoint, point));
};

const isPointInsideStructuredText = (node: StructuredTextNode, point: Point) =>
  withPointWithinBounds(point, getStructuredNodeBounds(node), false);

const isPointInsideStructuredBg = (node: StructuredBgNode, point: Point) =>
  withPointWithinBounds(point, getStructuredNodeBounds(node), false);

export const findStructuredBoxHit = (
  scene: StructuredNode[],
  point: Point
): StructuredBoxHit | null => {
  const boxes = scene.filter(isBoxNode).sort((a, b) => b.order - a.order);
  for (const node of boxes) {
    if (!isPointInsideStructuredBox(node, point)) continue;
    return { node, handle: getStructuredBoxHandleAtPoint(node, point) };
  }
  return null;
};

export const findStructuredNodeHit = (
  scene: StructuredNode[],
  point: Point
): StructuredNodeHit | null => {
  const ordered = [...scene].sort((a, b) => b.order - a.order);
  for (const node of ordered) {
    if (node.type === "box") {
      if (!isPointInsideStructuredBox(node, point)) continue;
      return { node, kind: "box", handle: getStructuredBoxHandleAtPoint(node, point) };
    }
    if (node.type === "line") {
      if (!isPointOnStructuredLine(node, point)) continue;
      return { node, kind: "line", handle: getStructuredLineHandleAtPoint(node, point) };
    }
    if (node.type === "bg") {
      if (!isPointInsideStructuredBg(node, point)) continue;
      return { node, kind: "bg", handle: getStructuredBoxHandleAtPoint(node, point) };
    }
    if (!isPointInsideStructuredText(node, point)) continue;
    return { node, kind: "text", handle: null };
  }
  return null;
};

export const findStructuredNodeIdsInSelection = (
  scene: StructuredNode[],
  area: SelectionArea
): string[] => {
  const { minX, minY, maxX, maxY } = getSelectionBounds(area);
  const selectionBounds = {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
  return scene
    .filter((node) =>
      intersectsBounds(getStructuredNodeBounds(node), selectionBounds)
    )
    .sort((a, b) => a.order - b.order)
    .map((node) => node.id);
};

export const moveStructuredNode = <T extends StructuredNode>(
  node: T,
  delta: Point
): T => {
  if (node.type === "text") {
    return {
      ...node,
      position: { x: node.position.x + delta.x, y: node.position.y + delta.y },
    } as T;
  }

  return {
    ...node,
    start: { x: node.start.x + delta.x, y: node.start.y + delta.y },
    end: { x: node.end.x + delta.x, y: node.end.y + delta.y },
  } as T;
};

export const moveStructuredBox = (
  node: StructuredBoxNode,
  delta: Point
): StructuredBoxNode => moveStructuredNode(node, delta);

export const resizeStructuredLine = (
  node: StructuredLineNode,
  handle: StructuredLineResizeHandle,
  point: Point
): StructuredLineNode => {
  const start = handle === "start" ? { ...point } : node.start;
  const end = handle === "end" ? { ...point } : node.end;
  const axis = Math.abs(end.y - start.y) > Math.abs(end.x - start.x)
    ? "vertical"
    : "horizontal";
  return { ...node, start, end, axis };
};

export const resizeStructuredRect = <T extends StructuredRectNode>(
  node: T,
  handle: StructuredBoxResizeHandle,
  point: Point
): T => {
  const bounds = getStructuredNodeBounds(node);
  let left = bounds.x;
  let right = bounds.x + bounds.width - 1;
  let top = bounds.y;
  let bottom = bounds.y + bounds.height - 1;

  if (handle.includes("w")) left = point.x;
  if (handle.includes("e")) right = point.x;
  if (handle.includes("n")) top = point.y;
  if (handle.includes("s")) bottom = point.y;

  const nextLeft = Math.min(left, right);
  const nextRight = Math.max(left, right);
  const nextTop = Math.min(top, bottom);
  const nextBottom = Math.max(top, bottom);

  return {
    ...node,
    start: { x: nextLeft, y: nextTop },
    end: { x: nextRight, y: nextBottom },
  } as T;
};

export const resizeStructuredBox = (
  node: StructuredBoxNode,
  handle: StructuredBoxResizeHandle,
  point: Point
): StructuredBoxNode => resizeStructuredRect(node, handle, point);

