import type { GridCell, NodeBounds, Point } from "@/shared/types";
import type { StructuredNode } from "./types";
import { normalizeCellStyle } from "@/shared/utils/ansi";
import { createEntityId } from "@/shared/utils/id";
import { mergeStructuredTextStyle } from "./text-ranges";
import { getArrowLinePoints, getBoxPoints, getLShapeLinePoints } from "@/shared/utils/shapes";
import { getSplitBoxPoints } from "./split-box-geometry";
import {
  getCellOccupancy,
  getTextCellWidth,
  splitGraphemes,
} from "@/shared/metrics";
import {
  createTextLayout,
  getTextLayoutSurfaceCells,
} from "./text-layout";

const placeStyledCharInMap = (
  targetMap: {
    set(key: string, value: GridCell): void;
  },
  bgLayer: Map<string, string>,
  visibleForegroundKeys: Set<string>,
  x: number,
  y: number,
  char: string,
  style: StructuredNode["style"]
) => {
  const key = `${x},${y}`;
  const bgColor = style.bgColor ?? bgLayer.get(key);
  targetMap.set(
    key,
    normalizeCellStyle({ char, ...style, ...(bgColor ? { bgColor } : {}) })
  );
  visibleForegroundKeys.add(key);

  const occupancy = getCellOccupancy(char);
  for (let offset = 1; offset < occupancy; offset++) {
    const followerKey = `${x + offset},${y}`;
    const followerBgColor = style.bgColor ?? bgLayer.get(followerKey);
    targetMap.set(
      followerKey,
      normalizeCellStyle({
        char: " ",
        ...style,
        ...(followerBgColor ? { bgColor: followerBgColor } : {}),
      })
    );
    visibleForegroundKeys.add(followerKey);
  }
};

const toBounds = (start: Point, end: Point): NodeBounds => {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
};

const boundsArea = (bounds: NodeBounds) => bounds.width * bounds.height;

const getBoxNameTextCapacity = (bounds: NodeBounds) => Math.max(0, bounds.width - 5);

export const getTextColumnWidth = (text: string) => {
  return getTextCellWidth(text);
};

export const trimTextToColumns = (text: string, maxColumns: number) => {
  if (maxColumns <= 0 || !text) return "";
  let width = 0;
  let out = "";
  for (const char of splitGraphemes(text)) {
    const charWidth = getCellOccupancy(char);
    if (width + charWidth > maxColumns) break;
    width += charWidth;
    out += char;
  }
  return out;
};

export const getStructuredNodeBounds = (node: StructuredNode): NodeBounds => {
  if (node.type === "box" || node.type === "splitBox" || node.type === "bg") {
    return toBounds(node.start, node.end);
  }

  if (node.type === "line") {
    const points = node.endMarker === "arrow"
      ? getArrowLinePoints(node.start, node.end, node.axis === "vertical")
      : getLShapeLinePoints(node.start, node.end, node.axis === "vertical");
    if (points.length === 0) return toBounds(node.start, node.end);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    points.forEach((point) => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    });
    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  const layout = createTextLayout(node.text, node.position);
  const width = Math.max(1, ...layout.lineWidths);
  return {
    x: node.position.x,
    y: node.position.y,
    width,
    height: Math.max(1, layout.lineWidths.length),
  };
};

const sortForDeterminism = (nodes: StructuredNode[]) => {
  return [...nodes].sort((a, b) => {
    const aBounds = getStructuredNodeBounds(a);
    const bBounds = getStructuredNodeBounds(b);
    if (aBounds.y !== bBounds.y) return aBounds.y - bBounds.y;
    if (aBounds.x !== bBounds.x) return aBounds.x - bBounds.x;
    if (a.order !== b.order) return a.order - b.order;
    return a.id.localeCompare(b.id);
  });
};

export const renderStructuredScene = (scene: readonly StructuredNode[]) => {
  const grid = new Map<string, GridCell>();
  const bgLayer = new Map<string, string>();
  const visibleForegroundKeys = new Set<string>();
  const ordered = [...scene].sort((a, b) => a.order - b.order);

  ordered.forEach((node) => {
    if (node.type === "box") {
      const points = getBoxPoints(node.start, node.end);
      points.forEach((point) => {
        placeStyledCharInMap(
          grid,
          bgLayer,
          visibleForegroundKeys,
          point.x,
          point.y,
          point.char,
          node.style
        );
      });
      if (node.name) {
        const bounds = getStructuredNodeBounds(node);
        const label = trimTextToColumns(node.name, getBoxNameTextCapacity(bounds));
        if (!label) return;
        let writeX = bounds.x + 2;
        for (const char of splitGraphemes(` ${label} `)) {
          placeStyledCharInMap(
            grid,
            bgLayer,
            visibleForegroundKeys,
            writeX,
            bounds.y,
            char,
            node.style
          );
          writeX += getCellOccupancy(char);
          if (writeX >= bounds.x + bounds.width - 1) break;
        }
      }
      return;
    }

    if (node.type === "line") {
      const points = node.endMarker === "arrow"
        ? getArrowLinePoints(node.start, node.end, node.axis === "vertical")
        : getLShapeLinePoints(node.start, node.end, node.axis === "vertical");
      points.forEach((point) => {
        placeStyledCharInMap(
          grid,
          bgLayer,
          visibleForegroundKeys,
          point.x,
          point.y,
          point.char,
          node.style
        );
      });
      return;
    }

    if (node.type === "splitBox") {
      const points = getSplitBoxPoints(node.start, node.end, {
        verticalSplitRatio: node.verticalSplitRatio,
        topSplitRatio: node.topSplitRatio,
        bottomSplitRatio: node.bottomSplitRatio,
        root: node.root,
      });
      points.forEach((point) => {
        placeStyledCharInMap(
          grid,
          bgLayer,
          visibleForegroundKeys,
          point.x,
          point.y,
          point.char,
          node.style
        );
      });
      return;
    }

    if (node.type === "bg") {
      const bounds = getStructuredNodeBounds(node);
      for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
        for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
          const key = `${x},${y}`;
          if (node.style.bgColor) bgLayer.set(key, node.style.bgColor);
          visibleForegroundKeys.delete(key);
          grid.set(key, normalizeCellStyle({ char: " ", ...node.style }));
        }
      }
      return;
    }

    getTextLayoutSurfaceCells(
      createTextLayout(node.text, node.position),
      (offset) => mergeStructuredTextStyle(node.style, node.styleRanges, offset)
    ).forEach((cell) => {
      const key = `${cell.x},${cell.y}`;
      const bgColor = cell.bgColor ?? bgLayer.get(key);
      grid.set(
        key,
        normalizeCellStyle({
          char: cell.char,
          color: cell.color,
          ...(bgColor ? { bgColor } : {}),
          ...(cell.attrs ? { attrs: cell.attrs } : {}),
        })
      );
      visibleForegroundKeys.add(key);
    });
  });

  return grid;
};

type SceneGridEntriesCacheEntry = {
  scene: readonly StructuredNode[];
  entries: Array<[string, GridCell]>;
};

const sceneGridEntriesCache = new WeakMap<
  readonly StructuredNode[],
  SceneGridEntriesCacheEntry
>();

export const sceneToGridEntries = (scene: readonly StructuredNode[]) => {
  const cached = sceneGridEntriesCache.get(scene);
  if (
    cached &&
    cached.scene.length === scene.length &&
    scene.every((node, index) => node === cached.scene[index])
  ) {
    return cached.entries;
  }
  const entries = Array.from(renderStructuredScene(scene).entries());
  sceneGridEntriesCache.set(scene, { scene: [...scene], entries });
  return entries;
};

export const createStructuredNodeId = () => createEntityId("node");

export const containsBounds = (outer: NodeBounds, inner: NodeBounds) => {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
};

export const intersectsBounds = (a: NodeBounds, b: NodeBounds) => {
  const aRight = a.x + a.width - 1;
  const aBottom = a.y + a.height - 1;
  const bRight = b.x + b.width - 1;
  const bBottom = b.y + b.height - 1;
  return a.x <= bRight && aRight >= b.x && a.y <= bBottom && aBottom >= b.y;
};

export const buildStructuredTree = (scene: StructuredNode[]) => {
  const sorted = sortForDeterminism(scene);
  const byId = new Map(sorted.map((node) => [node.id, node]));
  const boundsById = new Map(sorted.map((node) => [node.id, getStructuredNodeBounds(node)]));
  const boxes = sorted.filter((node) => node.type === "box" || node.type === "splitBox");
  const parentById = new Map<string, string | null>();
  const childrenById = new Map<string, StructuredNode[]>();

  sorted.forEach((node) => {
    const nodeBounds = boundsById.get(node.id)!;
    let parentId: string | null = null;
    let parentArea = Infinity;

    boxes.forEach((candidate) => {
      if (candidate.id === node.id) return;
      const candidateBounds = boundsById.get(candidate.id)!;
      if (!containsBounds(candidateBounds, nodeBounds)) return;
      const area = boundsArea(candidateBounds);
      if (area < parentArea) {
        parentId = candidate.id;
        parentArea = area;
      }
    });

    parentById.set(node.id, parentId);
  });

  sorted.forEach((node) => {
    childrenById.set(node.id, []);
  });

  sorted.forEach((node) => {
    const parentId = parentById.get(node.id);
    if (!parentId) return;
    const children = childrenById.get(parentId);
    if (!children) return;
    children.push(node);
  });

  childrenById.forEach((children, id) => {
    childrenById.set(
      id,
      children.sort((a, b) => {
        const aBounds = boundsById.get(a.id)!;
        const bBounds = boundsById.get(b.id)!;
        if (aBounds.y !== bBounds.y) return aBounds.y - bBounds.y;
        if (aBounds.x !== bBounds.x) return aBounds.x - bBounds.x;
        if (a.order !== b.order) return a.order - b.order;
        return a.id.localeCompare(b.id);
      })
    );
  });

  const roots = sorted.filter((node) => !parentById.get(node.id));
  return { roots, byId, childrenById, boundsById };
};

export const withPointWithinBounds = (
  point: Point,
  bounds: NodeBounds,
  allowEnd = true
) => {
  const maxX = bounds.x + bounds.width - (allowEnd ? 0 : 1);
  const maxY = bounds.y + bounds.height - 1;
  return (
    point.x >= bounds.x &&
    point.x <= maxX &&
    point.y >= bounds.y &&
    point.y <= maxY
  );
};

export const normalizeScene = (scene: StructuredNode[]): StructuredNode[] => {
  return [...scene].sort((a, b) => a.order - b.order);
};
