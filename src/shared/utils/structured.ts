import type { GridCell, NodeBounds, Point, StructuredNode } from "@/shared/types";
import { normalizeCellStyle } from "@/shared/utils/ansi";
import { mergeStructuredTextStyle } from "@/shared/utils/structuredTextRanges";
import { getBoxPoints, getLShapeLinePoints } from "@/shared/utils/shapes";
import {
  getCellOccupancy,
  getTextCellWidth,
  splitGraphemes,
} from "@/shared/metrics";

const placeStyledCharInMap = (
  targetMap: {
    set(key: string, value: GridCell): void;
  },
  x: number,
  y: number,
  char: string,
  style: StructuredNode["style"]
) => {
  targetMap.set(
    `${x},${y}`,
    normalizeCellStyle({ char, ...style })
  );

  const occupancy = getCellOccupancy(char);
  for (let offset = 1; offset < occupancy; offset++) {
    targetMap.set(
      `${x + offset},${y}`,
      normalizeCellStyle({ char: " ", ...style })
    );
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

const splitLines = (text: string) => text.split("\n");

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
  if (node.type === "box" || node.type === "bg") {
    return toBounds(node.start, node.end);
  }

  if (node.type === "line") {
    const points = getLShapeLinePoints(node.start, node.end, node.axis === "vertical");
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

  const lines = splitLines(node.text);
  const width = Math.max(1, ...lines.map((line) => getTextColumnWidth(line)));
  return {
    x: node.position.x,
    y: node.position.y,
    width,
    height: Math.max(1, lines.length),
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

export const renderStructuredScene = (scene: StructuredNode[]) => {
  const grid = new Map<string, GridCell>();
  const ordered = [...scene].sort((a, b) => a.order - b.order);

  ordered.forEach((node) => {
    if (node.type === "box") {
      const points = getBoxPoints(node.start, node.end);
      points.forEach((point) => {
        placeStyledCharInMap(grid, point.x, point.y, point.char, node.style);
      });
      if (node.name) {
        const bounds = getStructuredNodeBounds(node);
        const label = trimTextToColumns(node.name, getBoxNameTextCapacity(bounds));
        if (!label) return;
        let writeX = bounds.x + 2;
        for (const char of splitGraphemes(` ${label} `)) {
          placeStyledCharInMap(grid, writeX, bounds.y, char, node.style);
          writeX += getCellOccupancy(char);
          if (writeX >= bounds.x + bounds.width - 1) break;
        }
      }
      return;
    }

    if (node.type === "line") {
      const points = getLShapeLinePoints(node.start, node.end, node.axis === "vertical");
      points.forEach((point) => {
        placeStyledCharInMap(grid, point.x, point.y, point.char, node.style);
      });
      return;
    }

    if (node.type === "bg") {
      const bounds = getStructuredNodeBounds(node);
      for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
        for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
          placeStyledCharInMap(grid, x, y, " ", node.style);
        }
      }
      return;
    }

    const lines = splitLines(node.text);
    let textOffset = 0;
    lines.forEach((line, rowIndex) => {
      let currentX = node.position.x;
      for (const char of splitGraphemes(line)) {
        placeStyledCharInMap(
          grid,
          currentX,
          node.position.y + rowIndex,
          char,
          mergeStructuredTextStyle(node.style, node.styleRanges, textOffset)
        );
        currentX += getCellOccupancy(char);
        textOffset += 1;
      }
      if (rowIndex < lines.length - 1) textOffset += 1;
    });
  });

  return grid;
};

export const sceneToGridEntries = (scene: StructuredNode[]) => {
  return Array.from(renderStructuredScene(scene).entries());
};

export const createStructuredNodeId = () => {
  return `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
};

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
  const boxes = sorted.filter((node) => node.type === "box");
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
