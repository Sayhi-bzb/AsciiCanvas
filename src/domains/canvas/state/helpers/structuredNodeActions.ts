import type { Point, StructuredNode } from "@/shared/types";
import { createStructuredNodeId, getStructuredNodeBounds, withPointWithinBounds } from "@/shared/utils/structured";

export type StructuredLayerDirection = "forward" | "backward" | "front" | "back";

const normalizeOrders = (scene: StructuredNode[]) =>
  scene.map((node, index) => ({ ...node, order: index + 1 }));

const sortByOrder = (scene: StructuredNode[]) =>
  [...scene].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

export const reorderStructuredNodes = (
  scene: StructuredNode[],
  selectedIds: string[],
  direction: StructuredLayerDirection
) => {
  const selected = new Set(selectedIds);
  if (selected.size === 0) return normalizeOrders(sortByOrder(scene));

  const ordered = normalizeOrders(sortByOrder(scene));
  const isSelected = (node: StructuredNode) => selected.has(node.id);

  if (direction === "front") {
    return normalizeOrders([
      ...ordered.filter((node) => !isSelected(node)),
      ...ordered.filter(isSelected),
    ]);
  }

  if (direction === "back") {
    return normalizeOrders([
      ...ordered.filter(isSelected),
      ...ordered.filter((node) => !isSelected(node)),
    ]);
  }

  const next = [...ordered];
  if (direction === "forward") {
    for (let index = next.length - 2; index >= 0; index -= 1) {
      if (!isSelected(next[index]) || isSelected(next[index + 1])) continue;
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
    }
  } else {
    for (let index = 1; index < next.length; index += 1) {
      if (!isSelected(next[index]) || isSelected(next[index - 1])) continue;
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
    }
  }

  return normalizeOrders(next);
};

const offsetPoint = (point: Point, offset: Point): Point => ({
  x: point.x + offset.x,
  y: point.y + offset.y,
});


export const findStructuredNodeIdAtPoint = (
  scene: StructuredNode[],
  point: Point
) => {
  const ordered = sortByOrder(scene).reverse();
  return (
    ordered.find((node) =>
      withPointWithinBounds(point, getStructuredNodeBounds(node), true)
    )?.id ?? null
  );
};

export const duplicateStructuredNodes = (
  scene: StructuredNode[],
  selectedIds: string[],
  offset: Point = { x: 1, y: 1 }
) => {
  const selected = new Set(selectedIds);
  const ordered = normalizeOrders(sortByOrder(scene));
  const highestOrder = ordered.length;
  const duplicates = ordered
    .filter((node) => selected.has(node.id))
    .map((node, index): StructuredNode => {
      if (node.type === "box" || node.type === "splitBox") {
        return {
          ...node,
          id: createStructuredNodeId(),
          order: highestOrder + index + 1,
          style: { ...node.style },
          start: offsetPoint(node.start, offset),
          end: offsetPoint(node.end, offset),
        };
      }

      if (node.type === "line") {
        return {
          ...node,
          id: createStructuredNodeId(),
          order: highestOrder + index + 1,
          style: { ...node.style },
          start: offsetPoint(node.start, offset),
          end: offsetPoint(node.end, offset),
        };
      }

      if (node.type === "bg") {
        return {
          ...node,
          id: createStructuredNodeId(),
          order: highestOrder + index + 1,
          style: { ...node.style },
          start: offsetPoint(node.start, offset),
          end: offsetPoint(node.end, offset),
        };
      }

      return {
        ...node,
        id: createStructuredNodeId(),
        order: highestOrder + index + 1,
        style: { ...node.style },
        position: offsetPoint(node.position, offset),
      };
    });

  return {
    scene: normalizeOrders([...ordered, ...duplicates]),
    duplicatedIds: duplicates.map((node) => node.id),
  };
};
