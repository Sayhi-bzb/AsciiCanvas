import type { CanvasSurfaceChanges } from "@/domains/canvas/public";
import type { NodeBounds } from "@/shared/types";

const intersectBounds = (left: NodeBounds, right: NodeBounds): NodeBounds | null => {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const rightEdge = Math.min(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.min(left.y + left.height, right.y + right.height);
  return rightEdge > x && bottomEdge > y
    ? { x, y, width: rightEdge - x, height: bottomEdge - y }
    : null;
};

/** Adds a one-cell glyph/occupancy halo and clips invalidations to the viewport. */
export const getIncrementalBackgroundBounds = (
  changes: CanvasSurfaceChanges,
  viewport: NodeBounds
): NodeBounds[] | null => {
  if (changes.full) return null;
  const result: NodeBounds[] = [];
  for (const bounds of changes.bounds) {
    const clipped = intersectBounds({
      x: bounds.x - 1,
      y: bounds.y - 1,
      width: bounds.width + 2,
      height: bounds.height + 2,
    }, viewport);
    if (clipped) result.push(clipped);
  }
  return result;
};
