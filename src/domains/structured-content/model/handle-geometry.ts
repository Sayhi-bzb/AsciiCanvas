import type {
  NodeBounds,
  Point,
  StructuredSplitBoxNode,
} from "@/shared/types";
import {
  getStructuredSplitBoxGuides,
  type StructuredBoxResizeHandle,
  type StructuredLineResizeHandle,
  type StructuredSplitBoxHandle,
} from "./box";

type RectHandlePoint = {
  handle: StructuredBoxResizeHandle;
  xRatio: number;
  yRatio: number;
};

export const getStructuredRectHandlePoints = (
  _bounds: NodeBounds
): RectHandlePoint[] => {
  return [
    { handle: "nw", xRatio: 0, yRatio: 0 },
    { handle: "n", xRatio: 0.5, yRatio: 0 },
    { handle: "ne", xRatio: 1, yRatio: 0 },
    { handle: "e", xRatio: 1, yRatio: 0.5 },
    { handle: "se", xRatio: 1, yRatio: 1 },
    { handle: "s", xRatio: 0.5, yRatio: 1 },
    { handle: "sw", xRatio: 0, yRatio: 1 },
    { handle: "w", xRatio: 0, yRatio: 0.5 },
  ];
};

export const getStructuredLineHandlePoints = (): Array<{
  handle: StructuredLineResizeHandle;
  point: "start" | "end";
}> => [
  { handle: "start", point: "start" },
  { handle: "end", point: "end" },
];

export const getStructuredSplitBoxHandlePoints = (
  node: StructuredSplitBoxNode
): Array<{
  handle: StructuredSplitBoxHandle;
  point: Point;
}> => {
  const { handles, bounds } = getStructuredSplitBoxGuides(node);
  const left = bounds.x;
  const right = bounds.x + bounds.width - 1;
  const top = bounds.y;
  const bottom = bounds.y + bounds.height - 1;
  return [
    ...handles.map(({ id, axis, bounds: handleBounds }) => ({
      handle: `split:${id}` as StructuredSplitBoxHandle,
      point:
        axis === "vertical"
          ? {
              x: handleBounds.x,
              y: Math.round(handleBounds.y + (handleBounds.height - 1) / 2),
            }
          : {
              x: Math.round(handleBounds.x + (handleBounds.width - 1) / 2),
              y: handleBounds.y,
            },
    })),
    { handle: "nw", point: { x: left, y: top } },
    { handle: "n", point: { x: Math.round((left + right) / 2), y: top } },
    { handle: "ne", point: { x: right, y: top } },
    { handle: "e", point: { x: right, y: Math.round((top + bottom) / 2) } },
    { handle: "se", point: { x: right, y: bottom } },
    { handle: "s", point: { x: Math.round((left + right) / 2), y: bottom } },
    { handle: "sw", point: { x: left, y: bottom } },
    { handle: "w", point: { x: left, y: Math.round((top + bottom) / 2) } },
  ];
};
