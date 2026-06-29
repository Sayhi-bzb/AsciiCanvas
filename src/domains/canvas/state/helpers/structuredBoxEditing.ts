import type { NodeBounds, Point, SelectionArea, StructuredBoxNode, StructuredNode } from "@/shared/types";
import { getSelectionBounds } from "@/shared/utils/selection";
import { getStructuredNodeBounds, intersectsBounds } from "@/shared/utils/structured";

export type StructuredBoxResizeHandle =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w";

export type StructuredBoxHit = {
  node: StructuredBoxNode;
  handle: StructuredBoxResizeHandle | null;
};

const isBoxNode = (node: StructuredNode): node is StructuredBoxNode =>
  node.type === "box";

export const getStructuredBoxBounds = (node: StructuredBoxNode): NodeBounds =>
  getStructuredNodeBounds(node);

export const getStructuredBoxHandleAtPoint = (
  node: StructuredBoxNode,
  point: Point
): StructuredBoxResizeHandle | null => {
  const bounds = getStructuredBoxBounds(node);
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

export const moveStructuredBox = (
  node: StructuredBoxNode,
  delta: Point
): StructuredBoxNode => ({
  ...node,
  start: { x: node.start.x + delta.x, y: node.start.y + delta.y },
  end: { x: node.end.x + delta.x, y: node.end.y + delta.y },
});

export const resizeStructuredBox = (
  node: StructuredBoxNode,
  handle: StructuredBoxResizeHandle,
  point: Point
): StructuredBoxNode => {
  const bounds = getStructuredBoxBounds(node);
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
  };
};
