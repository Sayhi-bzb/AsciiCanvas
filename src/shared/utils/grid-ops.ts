import { GridManager } from "@/shared/utils/grid";
import type { GridCell, GridMap } from "@/shared/types";
import { isWideCell } from "@/shared/metrics";

type GridTarget = {
  set(key: string, value: GridCell): void;
  delete(key: string): void;
  get(key: string): GridCell | undefined;
};

type WriteResult = {
  wrote: boolean;
  removedLeftAnchor: boolean;
  removedRightFollower: boolean;
};

type RemoveResult = {
  removedAnchors: number;
  removedFollowers: number;
};

const getCell = (grid: GridMap, x: number, y: number) => {
  return grid.get(GridManager.toKey(x, y));
};

export const writeCell = (
  target: GridTarget,
  x: number,
  y: number,
  char: string,
  color: string
): WriteResult => {
  return writeStyledCell(target, x, y, { char, color });
};

export const writeStyledCell = (
  target: GridTarget,
  x: number,
  y: number,
  cell: GridCell
): WriteResult => {
  const { char } = cell;
  if (!char) {
    return {
      wrote: false,
      removedLeftAnchor: false,
      removedRightFollower: false,
    };
  }

  const leftKey = GridManager.toKey(x - 1, y);
  const leftCell = target.get(leftKey);
  const removedLeftAnchor = !!leftCell && isWideCell(leftCell.char);
  if (removedLeftAnchor) {
    target.delete(leftKey);
  }

  target.set(GridManager.toKey(x, y), cell);

  const removedRightFollower = isWideCell(char);
  if (removedRightFollower) {
    target.delete(GridManager.toKey(x + 1, y));
  }

  return {
    wrote: true,
    removedLeftAnchor,
    removedRightFollower,
  };
};

export const deleteCellAt = (
  target: GridTarget,
  x: number,
  y: number
): RemoveResult => {
  const key = GridManager.toKey(x, y);
  const cell = target.get(key);
  if (cell) {
    target.delete(key);
    return { removedAnchors: 1, removedFollowers: 0 };
  }

  const leftKey = GridManager.toKey(x - 1, y);
  const leftCell = target.get(leftKey);
  if (leftCell && isWideCell(leftCell.char)) {
    target.delete(leftKey);
    return { removedAnchors: 1, removedFollowers: 1 };
  }

  return { removedAnchors: 0, removedFollowers: 0 };
};

export const deleteRect = (
  target: GridTarget,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): RemoveResult => {
  let removedAnchors = 0;
  let removedFollowers = 0;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const result = deleteCellAt(target, x, y);
      removedAnchors += result.removedAnchors;
      removedFollowers += result.removedFollowers;
    }
  }

  return { removedAnchors, removedFollowers };
};

export const resolveBackspaceAnchor = (
  grid: GridMap,
  cursorX: number,
  cursorY: number
) => {
  const cellAtMinus1 = getCell(grid, cursorX - 1, cursorY);
  const cellAtMinus2 = getCell(grid, cursorX - 2, cursorY);
  if (
    !cellAtMinus1 &&
    cellAtMinus2 &&
    isWideCell(cellAtMinus2.char)
  ) {
    return { x: cursorX - 2, y: cursorY };
  }

  return { x: cursorX - 1, y: cursorY };
};
