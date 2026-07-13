import type { NodeBounds, Point, SelectionArea, StructuredBgNode, StructuredBoxNode, StructuredLineNode, StructuredNode, StructuredSplitBoxNode, StructuredTextNode } from "@/shared/types";
import { getTextCellWidth } from "@/shared/metrics";
import { getSelectionBounds } from "@/shared/utils/selection";
import {
  getLShapeLinePoints,
  layoutSplitBoxTree,
  normalizeSplitBoxRoot,
} from "@/shared/utils/shapes";
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
export type StructuredSplitBoxSplitHandle = `split:${string}`;
export type StructuredSplitBoxHandle = StructuredBoxResizeHandle | StructuredSplitBoxSplitHandle;

export type StructuredBoxHit = {
  node: StructuredBoxNode;
  handle: StructuredBoxResizeHandle | null;
};

export type StructuredNodeHit =
  | { node: StructuredBoxNode; kind: "box"; handle: StructuredBoxResizeHandle | null }
  | { node: StructuredSplitBoxNode; kind: "splitBox"; handle: StructuredSplitBoxHandle | null }
  | { node: StructuredLineNode; kind: "line"; handle: StructuredLineResizeHandle | null }
  | { node: StructuredBgNode; kind: "bg"; handle: StructuredBoxResizeHandle | null }
  | { node: StructuredTextNode; kind: "text"; handle: null };

const isBoxNode = (node: StructuredNode): node is StructuredBoxNode =>
  node.type === "box";

const isPointEqual = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

type StructuredRectNode = StructuredBoxNode | StructuredSplitBoxNode | StructuredBgNode;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const toStructuredSplitBoxHandle = (
  splitId: string
): StructuredSplitBoxSplitHandle => `split:${splitId}`;

export const isStructuredSplitBoxLineHandle = (
  handle: StructuredSplitBoxHandle | null
): handle is StructuredSplitBoxSplitHandle =>
  typeof handle === "string" && handle.startsWith("split:");

export const getStructuredSplitBoxHandleId = (
  handle: StructuredSplitBoxSplitHandle
) => handle.slice("split:".length);

const collectStructuredSplitBoxTreeIds = (
  tree: ReturnType<typeof normalizeSplitBoxRoot>,
  ids = new Set<string>()
) => {
  ids.add(tree.id);
  if (tree.type === "split") {
    collectStructuredSplitBoxTreeIds(tree.first, ids);
    collectStructuredSplitBoxTreeIds(tree.second, ids);
  }
  return ids;
};

const createStructuredSplitBoxTreeId = (
  root: ReturnType<typeof normalizeSplitBoxRoot>,
  prefix: string
) => {
  const ids = collectStructuredSplitBoxTreeIds(root);
  let index = ids.size + 1;
  let candidate = `${prefix}-${index}`;
  while (ids.has(candidate)) {
    index += 1;
    candidate = `${prefix}-${index}`;
  }
  return candidate;
};

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

export const getStructuredSplitBoxGuides = (node: StructuredSplitBoxNode) => {
  const bounds = getStructuredNodeBounds(node);
  const root = normalizeSplitBoxRoot(node.root, {
    verticalSplitRatio: node.verticalSplitRatio,
    topSplitRatio: node.topSplitRatio,
    bottomSplitRatio: node.bottomSplitRatio,
  });
  return { ...layoutSplitBoxTree(root, bounds), bounds };
};

export const getStructuredSplitBoxHandleAtPoint = (
  node: StructuredSplitBoxNode,
  point: Point
): StructuredSplitBoxHandle | null => {
  const rectHandle = getStructuredBoxHandleAtPoint(node, point);
  if (rectHandle) return rectHandle;

  const { handles } = getStructuredSplitBoxGuides(node);
  const hit = handles.find(({ axis, bounds }) => {
    if (axis === "vertical") {
      return (
        point.x === bounds.x &&
        point.y >= bounds.y &&
        point.y < bounds.y + bounds.height
      );
    }
    return (
      point.y === bounds.y &&
      point.x >= bounds.x &&
      point.x < bounds.x + bounds.width
    );
  });
  if (hit) return toStructuredSplitBoxHandle(hit.id);
  return null;
};

export const getStructuredSplitBoxLeafAtPoint = (
  node: StructuredSplitBoxNode,
  point: Point
) => {
  const { leafBounds } = getStructuredSplitBoxGuides(node);
  return (
    leafBounds.find(({ bounds }) =>
      withPointWithinBounds(point, bounds, true)
    ) ?? null
  );
};

export const canSplitStructuredSplitBoxLeaf = (
  leaf: { bounds: NodeBounds },
  axis: "horizontal" | "vertical"
) =>
  axis === "vertical"
    ? leaf.bounds.width >= 5
    : leaf.bounds.height >= 5;

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
  point: Point,
  _selectedNodeIds: string[] = []
): StructuredNodeHit | null => {
  const ordered = [...scene].sort((a, b) => b.order - a.order);
  for (const node of ordered) {
    if (node.type === "box") {
      if (!isPointInsideStructuredBox(node, point)) continue;
      return { node, kind: "box", handle: getStructuredBoxHandleAtPoint(node, point) };
    }
    if (node.type === "splitBox") {
      if (!withPointWithinBounds(point, getStructuredNodeBounds(node), false)) continue;
      return { node, kind: "splitBox", handle: getStructuredSplitBoxHandleAtPoint(node, point) };
    }
    if (node.type === "line") {
      if (!isPointOnStructuredLine(node, point)) continue;
      return { node, kind: "line", handle: getStructuredLineHandleAtPoint(node, point) };
    }
    if (node.type === "bg") {
      if (!isPointInsideStructuredBg(node, point)) continue;
      return { node, kind: "bg", handle: null };
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

export const resizeStructuredSplitBox = (
  node: StructuredSplitBoxNode,
  handle: StructuredSplitBoxHandle,
  point: Point
): StructuredSplitBoxNode => {
  if (!isStructuredSplitBoxLineHandle(handle)) {
    return resizeStructuredRect(node, handle, point);
  }

  const targetId = getStructuredSplitBoxHandleId(handle);
  const root = normalizeSplitBoxRoot(node.root, {
    verticalSplitRatio: node.verticalSplitRatio,
    topSplitRatio: node.topSplitRatio,
    bottomSplitRatio: node.bottomSplitRatio,
  });
  const layout = layoutSplitBoxTree(root, getStructuredNodeBounds(node));
  const target = layout.handles.find((candidate) => candidate.id === targetId);
  if (!target) return node;

  const update = (
    tree: typeof root
  ): typeof root => {
    if (tree.type === "leaf") return tree;
    if (tree.id === targetId) {
      const bounds = target.parentBounds;
      const nextRatio =
        tree.axis === "vertical"
          ? (clamp(point.x, bounds.x + 1, bounds.x + bounds.width - 2) -
              bounds.x) /
            Math.max(1, bounds.width - 1)
          : (clamp(point.y, bounds.y + 1, bounds.y + bounds.height - 2) -
              bounds.y) /
            Math.max(1, bounds.height - 1);
      return { ...tree, ratio: clamp(nextRatio, 0.05, 0.95) };
    }
    return { ...tree, first: update(tree.first), second: update(tree.second) };
  };

  const nextRoot = update(root);
  const nextNode = { ...node, root: nextRoot };
  if (targetId === "split-middle") {
    const targetRatio =
      nextRoot.type === "split" &&
      nextRoot.second.type === "split" &&
      nextRoot.second.first.type === "split"
        ? nextRoot.second.first.ratio
        : node.verticalSplitRatio;
    return { ...nextNode, verticalSplitRatio: targetRatio };
  }
  if (targetId === "split-top" && nextRoot.type === "split") {
    return { ...nextNode, topSplitRatio: nextRoot.ratio };
  }
  if (
    targetId === "split-bottom" &&
    nextRoot.type === "split" &&
    nextRoot.second.type === "split"
  ) {
    return {
      ...nextNode,
      bottomSplitRatio:
        nextRoot.ratio + (1 - nextRoot.ratio) * nextRoot.second.ratio,
    };
  }
  return nextNode;
};

export const deleteStructuredSplitBoxSplit = (
  node: StructuredSplitBoxNode,
  handle: StructuredSplitBoxSplitHandle
): StructuredSplitBoxNode => {
  const targetId = getStructuredSplitBoxHandleId(handle);
  const root = normalizeSplitBoxRoot(node.root, {
    verticalSplitRatio: node.verticalSplitRatio,
    topSplitRatio: node.topSplitRatio,
    bottomSplitRatio: node.bottomSplitRatio,
  });
  const remove = (tree: typeof root): typeof root => {
    if (tree.type === "leaf") return tree;
    if (tree.id === targetId) return { type: "leaf", id: `leaf-${targetId}` };
    return { ...tree, first: remove(tree.first), second: remove(tree.second) };
  };
  return { ...node, root: remove(root) };
};

export const addStructuredSplitBoxSplit = (
  node: StructuredSplitBoxNode,
  leafId: string,
  axis: "horizontal" | "vertical"
): StructuredSplitBoxNode => {
  const root = normalizeSplitBoxRoot(node.root, {
    verticalSplitRatio: node.verticalSplitRatio,
    topSplitRatio: node.topSplitRatio,
    bottomSplitRatio: node.bottomSplitRatio,
  });
  const splitId = createStructuredSplitBoxTreeId(root, "split");
  const nextLeafId = createStructuredSplitBoxTreeId(root, "leaf");
  let didSplit = false;

  const split = (tree: typeof root): typeof root => {
    if (tree.type === "split") {
      return { ...tree, first: split(tree.first), second: split(tree.second) };
    }
    if (tree.id !== leafId) return tree;
    didSplit = true;
    return {
      type: "split",
      id: splitId,
      axis,
      ratio: 0.5,
      first: tree,
      second: { type: "leaf", id: nextLeafId },
    };
  };

  const nextRoot = split(root);
  return didSplit ? { ...node, root: nextRoot } : node;
};

export const resizeStructuredBox = (
  node: StructuredBoxNode,
  handle: StructuredBoxResizeHandle,
  point: Point
): StructuredBoxNode => resizeStructuredRect(node, handle, point);

