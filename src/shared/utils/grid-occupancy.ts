import { getCellOccupancy } from "@/shared/metrics";
import type { GridCell, Point } from "@/shared/types";

type GridReader = {
  get(key: string): GridCell | undefined;
};

interface OccupiedGridSlot {
  anchor: Point;
  cell: GridCell;
  offset: 0 | 1;
  width: 1 | 2;
}

interface GridFootprint {
  anchor: Point;
  cell: GridCell;
  width: 1 | 2;
  start: Point;
  end: Point;
}

const keyOf = (x: number, y: number) => `${x},${y}`;

export const getGridCellWidth = (cell: GridCell): 1 | 2 =>
  getCellOccupancy(cell.char) === 2 ? 2 : 1;

/** Resolves a visual grid column to its single logical cell anchor. */
export const resolveGridSlot = (
  grid: GridReader,
  point: Point
): OccupiedGridSlot | null => {
  const direct = grid.get(keyOf(point.x, point.y));
  if (direct) {
    return {
      anchor: { ...point },
      cell: direct,
      offset: 0,
      width: getGridCellWidth(direct),
    };
  }

  const left = grid.get(keyOf(point.x - 1, point.y));
  if (left && getGridCellWidth(left) === 2) {
    return {
      anchor: { x: point.x - 1, y: point.y },
      cell: left,
      offset: 1,
      width: 2,
    };
  }
  return null;
};

export const resolveGridAnchor = (grid: GridReader, point: Point): Point =>
  resolveGridSlot(grid, point)?.anchor ?? { ...point };

export const getGridFootprint = (
  grid: GridReader,
  point: Point
): GridFootprint | null => {
  const slot = resolveGridSlot(grid, point);
  if (!slot) return null;
  return {
    anchor: slot.anchor,
    cell: slot.cell,
    width: slot.width,
    start: { ...slot.anchor },
    end: { x: slot.anchor.x + slot.width - 1, y: slot.anchor.y },
  };
};

/** Returns every stored anchor intersecting the requested visual columns. */
export const getIntersectingGridAnchors = (
  grid: GridReader,
  start: Point,
  width: number
): Point[] => {
  const anchors = new Map<string, Point>();
  for (let x = start.x; x < start.x + width; x++) {
    const direct = grid.get(keyOf(x, start.y));
    if (direct) anchors.set(keyOf(x, start.y), { x, y: start.y });
    const left = grid.get(keyOf(x - 1, start.y));
    if (left && getGridCellWidth(left) === 2) {
      anchors.set(keyOf(x - 1, start.y), { x: x - 1, y: start.y });
    }
  }
  return [...anchors.values()];
};
