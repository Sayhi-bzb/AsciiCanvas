import { BOX_CHARS } from "@/shared/lib/constants";
import type { Point, GridPoint, NodeBounds, StructuredSplitBoxTreeNode } from "@/shared/types";

function resolvePointChars(points: Point[]): GridPoint[] {
  return points.map((p, i) => {
    const prev = points[i - 1];
    const next = points[i + 1];

    if (!prev && !next) return { ...p, char: BOX_CHARS.CROSS };

    const dIn = prev ? `${p.x - prev.x},${p.y - prev.y}` : null;
    const dOut = next ? `${next.x - p.x},${next.y - p.y}` : null;

    const isH = (d: string | null) => d === "1,0" || d === "-1,0";
    const isV = (d: string | null) => d === "0,1" || d === "0,-1";

    if ((isH(dIn) || !dIn) && (isH(dOut) || !dOut)) {
      return { ...p, char: BOX_CHARS.HORIZONTAL };
    }
    if ((isV(dIn) || !dIn) && (isV(dOut) || !dOut)) {
      return { ...p, char: BOX_CHARS.VERTICAL };
    }

    const combined = `${dIn}|${dOut}`;
    let char = BOX_CHARS.CROSS;

    switch (combined) {
      case "0,-1|1,0":
      case "-1,0|0,1":
        char = BOX_CHARS.TOP_LEFT;
        break;

      case "0,-1|-1,0":
      case "1,0|0,1":
        char = BOX_CHARS.TOP_RIGHT;
        break;

      case "0,1|1,0":
      case "-1,0|0,-1":
        char = BOX_CHARS.BOTTOM_LEFT;
        break;
      case "0,1|-1,0":
      case "1,0|0,-1":
        char = BOX_CHARS.BOTTOM_RIGHT;
        break;
    }

    return { ...p, char };
  });
}

export function getLShapeLinePoints(
  start: Point,
  end: Point,
  isVerticalFirst: boolean
): GridPoint[] {
  const points: Point[] = [];
  const junction = isVerticalFirst
    ? { x: start.x, y: end.y }
    : { x: end.x, y: start.y };

  const drawLine = (p1: Point, p2: Point) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    const stepX = dx === 0 ? 0 : dx / adx;
    const stepY = dy === 0 ? 0 : dy / ady;
    const steps = Math.max(adx, ady);

    for (let i = 0; i <= steps; i++) {
      points.push({ x: p1.x + i * stepX, y: p1.y + i * stepY });
    }
  };

  drawLine(start, junction);
  points.pop();
  drawLine(junction, end);

  const uniquePoints: Point[] = [];
  const seen = new Set();
  points.forEach((p) => {
    const key = `${p.x},${p.y}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniquePoints.push(p);
    }
  });

  return resolvePointChars(uniquePoints);
}

export function getStepLinePoints(start: Point, end: Point): GridPoint[] {
  const points: Point[] = [];
  let x = start.x;
  let y = start.y;
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  const sx = start.x < end.x ? 1 : -1;
  const sy = start.y < end.y ? 1 : -1;
  let err = dx - dy;

  points.push({ x, y });
  while (x !== end.x || y !== end.y) {
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
      points.push({ x, y });
    }
    if (x === end.x && y === end.y) break;
    if (e2 < dx) {
      err += dx;
      y += sy;
      points.push({ x, y });
    }
  }
  return resolvePointChars(points);
}

export function getBoxPoints(start: Point, end: Point): GridPoint[] {
  const points: GridPoint[] = [];
  const x1 = Math.min(start.x, end.x);
  const x2 = Math.max(start.x, end.x);
  const y1 = Math.min(start.y, end.y);
  const y2 = Math.max(start.y, end.y);

  for (let x = x1; x <= x2; x++) {
    for (let y = y1; y <= y2; y++) {
      if (x === x1 || x === x2 || y === y1 || y === y2) {
        let char = "";
        if (x === x1 && y === y1) char = BOX_CHARS.TOP_LEFT;
        else if (x === x2 && y === y1) char = BOX_CHARS.TOP_RIGHT;
        else if (x === x1 && y === y2) char = BOX_CHARS.BOTTOM_LEFT;
        else if (x === x2 && y === y2) char = BOX_CHARS.BOTTOM_RIGHT;
        else if (y === y1 || y === y2) char = BOX_CHARS.HORIZONTAL;
        else char = BOX_CHARS.VERTICAL;
        points.push({ x, y, char });
      }
    }
  }
  return points;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const createDefaultSplitBoxRoot = (ratios: {
  verticalSplitRatio: number;
  topSplitRatio: number;
  bottomSplitRatio: number;
}): StructuredSplitBoxTreeNode => {
  const middleRatio =
    ratios.bottomSplitRatio > ratios.topSplitRatio
      ? (ratios.bottomSplitRatio - ratios.topSplitRatio) /
        (1 - ratios.topSplitRatio)
      : 0.67;

  return {
    type: "split",
    id: "split-top",
    axis: "horizontal",
    ratio: ratios.topSplitRatio,
    first: { type: "leaf", id: "leaf-top" },
    second: {
      type: "split",
      id: "split-bottom",
      axis: "horizontal",
      ratio: clamp(middleRatio, 0.1, 0.9),
      first: {
        type: "split",
        id: "split-middle",
        axis: "vertical",
        ratio: ratios.verticalSplitRatio,
        first: { type: "leaf", id: "leaf-middle-left" },
        second: { type: "leaf", id: "leaf-middle-right" },
      },
      second: { type: "leaf", id: "leaf-bottom" },
    },
  };
};

const isSplitBoxTreeNode = (value: unknown): value is StructuredSplitBoxTreeNode => {
  if (!value || typeof value !== "object") return false;
  const node = value as Partial<StructuredSplitBoxTreeNode>;
  if (node.type === "leaf") return typeof node.id === "string";
  if (node.type !== "split") return false;
  const split = node as Partial<Extract<StructuredSplitBoxTreeNode, { type: "split" }>>;
  return (
    typeof split.id === "string" &&
    (split.axis === "horizontal" || split.axis === "vertical") &&
    typeof split.ratio === "number" &&
    Number.isFinite(split.ratio) &&
    isSplitBoxTreeNode(split.first) &&
    isSplitBoxTreeNode(split.second)
  );
};

export const normalizeSplitBoxRoot = (
  root: unknown,
  ratios: {
    verticalSplitRatio: number;
    topSplitRatio: number;
    bottomSplitRatio: number;
  }
): StructuredSplitBoxTreeNode =>
  isSplitBoxTreeNode(root) ? root : createDefaultSplitBoxRoot(ratios);

export type SplitBoxLineHandle = {
  id: string;
  axis: "horizontal" | "vertical";
  bounds: NodeBounds;
  parentBounds: NodeBounds;
};

export type SplitBoxLeafBounds = {
  id: string;
  bounds: NodeBounds;
};

export type SplitBoxLayout = {
  leaves: NodeBounds[];
  leafBounds: SplitBoxLeafBounds[];
  handles: SplitBoxLineHandle[];
};

const normalizeBounds = (start: Point, end: Point): NodeBounds => {
  const x1 = Math.min(start.x, end.x);
  const x2 = Math.max(start.x, end.x);
  const y1 = Math.min(start.y, end.y);
  const y2 = Math.max(start.y, end.y);
  return { x: x1, y: y1, width: x2 - x1 + 1, height: y2 - y1 + 1 };
};

export const layoutSplitBoxTree = (
  root: StructuredSplitBoxTreeNode,
  bounds: NodeBounds
): SplitBoxLayout => {
  const leaves: NodeBounds[] = [];
  const leafBounds: SplitBoxLeafBounds[] = [];
  const handles: SplitBoxLineHandle[] = [];
  const visit = (node: StructuredSplitBoxTreeNode, rect: NodeBounds) => {
    if (node.type === "leaf" || rect.width < 3 || rect.height < 3) {
      leaves.push(rect);
      leafBounds.push({ id: node.id, bounds: rect });
      return;
    }

    const left = rect.x;
    const right = rect.x + rect.width - 1;
    const top = rect.y;
    const bottom = rect.y + rect.height - 1;
    const ratio = clamp(node.ratio, 0.05, 0.95);

    if (node.axis === "vertical") {
      const splitX = clamp(
        left + Math.round((rect.width - 1) * ratio),
        left + 1,
        right - 1
      );
      handles.push({
        id: node.id,
        axis: "vertical",
        bounds: { x: splitX, y: top, width: 1, height: rect.height },
        parentBounds: rect,
      });
      visit(node.first, { x: left, y: top, width: splitX - left + 1, height: rect.height });
      visit(node.second, { x: splitX, y: top, width: right - splitX + 1, height: rect.height });
      return;
    }

    const splitY = clamp(
      top + Math.round((rect.height - 1) * ratio),
      top + 1,
      bottom - 1
    );
    handles.push({
      id: node.id,
      axis: "horizontal",
      bounds: { x: left, y: splitY, width: rect.width, height: 1 },
      parentBounds: rect,
    });
    visit(node.first, { x: left, y: top, width: rect.width, height: splitY - top + 1 });
    visit(node.second, { x: left, y: splitY, width: rect.width, height: bottom - splitY + 1 });
  };

  visit(root, bounds);
  return { leaves, leafBounds, handles };
};

const connectionGlyph = (
  up: boolean,
  right: boolean,
  down: boolean,
  left: boolean,
  outerCorner: string | null
) => {
  if (outerCorner) return outerCorner;
  const count = Number(up) + Number(right) + Number(down) + Number(left);
  if (count >= 4) return "┼";
  if (up && right && down) return "├";
  if (up && down && left) return "┤";
  if (right && down && left) return "┬";
  if (up && right && left) return "┴";
  if (up && down) return BOX_CHARS.VERTICAL;
  if (left && right) return BOX_CHARS.HORIZONTAL;
  if (right && down) return "┌";
  if (down && left) return "┐";
  if (up && right) return "└";
  if (up && left) return "┘";
  if (up || down) return BOX_CHARS.VERTICAL;
  return BOX_CHARS.HORIZONTAL;
};

const getLineGraphPoints = (rects: NodeBounds[]): GridPoint[] => {
  const connections = new Map<string, { up: boolean; right: boolean; down: boolean; left: boolean }>();
  const ensure = (x: number, y: number) => {
    const key = `${x},${y}`;
    const existing = connections.get(key);
    if (existing) return existing;
    const next = { up: false, right: false, down: false, left: false };
    connections.set(key, next);
    return next;
  };
  const connect = (x1: number, y1: number, x2: number, y2: number) => {
    const a = ensure(x1, y1);
    const b = ensure(x2, y2);
    if (x2 > x1) {
      a.right = true;
      b.left = true;
    } else if (x2 < x1) {
      a.left = true;
      b.right = true;
    } else if (y2 > y1) {
      a.down = true;
      b.up = true;
    } else if (y2 < y1) {
      a.up = true;
      b.down = true;
    }
  };

  rects.forEach((rect) => {
    const left = rect.x;
    const right = rect.x + rect.width - 1;
    const top = rect.y;
    const bottom = rect.y + rect.height - 1;
    for (let x = left; x < right; x++) {
      connect(x, top, x + 1, top);
      connect(x, bottom, x + 1, bottom);
    }
    for (let y = top; y < bottom; y++) {
      connect(left, y, left, y + 1);
      connect(right, y, right, y + 1);
    }
  });

  const allBounds = rects.reduce<NodeBounds | null>((acc, rect) => {
    if (!acc) return { ...rect };
    const left = Math.min(acc.x, rect.x);
    const top = Math.min(acc.y, rect.y);
    const right = Math.max(acc.x + acc.width - 1, rect.x + rect.width - 1);
    const bottom = Math.max(acc.y + acc.height - 1, rect.y + rect.height - 1);
    return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
  }, null);

  return Array.from(connections.entries()).map(([key, value]) => {
    const [x, y] = key.split(",").map(Number);
    const outerCorner =
      allBounds && x === allBounds.x && y === allBounds.y
        ? BOX_CHARS.TOP_LEFT
        : allBounds && x === allBounds.x + allBounds.width - 1 && y === allBounds.y
          ? BOX_CHARS.TOP_RIGHT
          : allBounds && x === allBounds.x && y === allBounds.y + allBounds.height - 1
            ? BOX_CHARS.BOTTOM_LEFT
            : allBounds && x === allBounds.x + allBounds.width - 1 && y === allBounds.y + allBounds.height - 1
              ? BOX_CHARS.BOTTOM_RIGHT
              : null;
    return {
      x,
      y,
      char: connectionGlyph(value.up, value.right, value.down, value.left, outerCorner),
    };
  });
};

export function getSplitBoxPoints(
  start: Point,
  end: Point,
  ratios: {
    verticalSplitRatio: number;
    topSplitRatio: number;
    bottomSplitRatio: number;
    root?: StructuredSplitBoxTreeNode;
  }
): GridPoint[] {
  const bounds = normalizeBounds(start, end);

  if (bounds.width < 3 || bounds.height < 3) return getBoxPoints(start, end);

  const root = normalizeSplitBoxRoot(ratios.root, ratios);
  return getLineGraphPoints(layoutSplitBoxTree(root, bounds).leaves);
}

export function getCirclePoints(center: Point, edge: Point): GridPoint[] {
  const dx = edge.x - center.x;
  const dy = edge.y - center.y;
  const radius = Math.sqrt(dx * dx + dy * 2 * (dy * 2)) * 2;

  if (radius < 1) return [{ x: center.x, y: center.y, char: "·" }];

  const result: GridPoint[] = [];
  const minX = Math.floor(center.x - radius / 2) - 1;
  const maxX = Math.ceil(center.x + radius / 2) + 1;
  const minY = Math.floor(center.y - radius / 4) - 1;
  const maxY = Math.ceil(center.y + radius / 4) + 1;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let brailleCode = 0;

      const dotMap = [
        [0, 0, 0x01],
        [0, 1, 0x02],
        [0, 2, 0x04],
        [1, 0, 0x08],
        [1, 1, 0x10],
        [1, 2, 0x20],
        [0, 3, 0x40],
        [1, 3, 0x80],
      ];

      dotMap.forEach(([dx_sub, dy_sub, bit]) => {
        const subX = x * 2 + dx_sub;
        const subY = y * 4 + dy_sub;
        const centerX_sub = center.x * 2;
        const centerY_sub = center.y * 4;

        const dist = Math.sqrt(
          Math.pow(subX - centerX_sub, 2) + Math.pow(subY - centerY_sub, 2)
        );

        if (Math.abs(dist - radius) < 0.8) {
          brailleCode |= bit;
        }
      });

      if (brailleCode > 0) {
        result.push({
          x,
          y,
          char: String.fromCharCode(0x2800 + brailleCode),
        });
      }
    }
  }

  return result;
}
