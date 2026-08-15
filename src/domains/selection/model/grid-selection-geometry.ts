import { union, type Polygon } from "polygon-clipping";
import type { Point } from "@/shared/types";
import type { GridBounds, GridRange } from "./static-grid";

export interface GridSelectionGeometry {
  polygons: Array<{ rings: Point[][] }>;
  bounds: GridBounds | null;
}

interface GridSelectionSpan {
  y: number;
  minX: number;
  maxX: number;
}

const normalizeRange = (range: GridRange): GridRange => ({
  start: {
    x: Math.min(range.start.x, range.end.x),
    y: Math.min(range.start.y, range.end.y),
  },
  end: {
    x: Math.max(range.start.x, range.end.x),
    y: Math.max(range.start.y, range.end.y),
  },
});

const rangeToPolygon = (range: GridRange): Polygon => {
  const normalized = normalizeRange(range);
  const minX = normalized.start.x;
  const minY = normalized.start.y;
  const maxX = normalized.end.x + 1;
  const maxY = normalized.end.y + 1;
  return [[
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
    [minX, minY],
  ]];
};

export const getGridSelectionGeometry = (
  ranges: GridRange[]
): GridSelectionGeometry => {
  if (ranges.length === 0) return { polygons: [], bounds: null };

  const normalized = ranges.map(normalizeRange);
  const minX = Math.min(...normalized.map((range) => range.start.x));
  const minY = Math.min(...normalized.map((range) => range.start.y));
  const maxX = Math.max(...normalized.map((range) => range.end.x));
  const maxY = Math.max(...normalized.map((range) => range.end.y));
  const [first, ...rest] = normalized.map(rangeToPolygon);
  const polygons = union(first, ...rest).map((polygon) => ({
    rings: polygon.map((ring) => ring.map(([x, y]) => ({ x, y }))),
  }));

  return {
    polygons,
    bounds: { start: { x: minX, y: minY }, end: { x: maxX, y: maxY } },
  };
};

export const forEachGridSelectionSpan = (
  ranges: GridRange[],
  visit: (span: GridSelectionSpan) => void
) => {
  if (ranges.length === 0) return;
  const normalized = ranges.map(normalizeRange);
  const minY = Math.min(...normalized.map((range) => range.start.y));
  const maxY = Math.max(...normalized.map((range) => range.end.y));

  for (let y = minY; y <= maxY; y++) {
    const intervals = normalized
      .filter((range) => y >= range.start.y && y <= range.end.y)
      .map((range) => ({ minX: range.start.x, maxX: range.end.x }))
      .sort((left, right) => left.minX - right.minX || left.maxX - right.maxX);
    if (intervals.length === 0) continue;

    let current = intervals[0];
    for (let index = 1; index < intervals.length; index++) {
      const next = intervals[index];
      if (next.minX <= current.maxX + 1) {
        current = { minX: current.minX, maxX: Math.max(current.maxX, next.maxX) };
      } else {
        visit({ y, ...current });
        current = next;
      }
    }
    visit({ y, ...current });
  }
};
