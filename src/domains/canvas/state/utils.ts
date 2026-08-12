import * as Y from "yjs";
import type { GridCell } from "@/shared/types";
import { writeCell, writeStyledCell } from "@/shared/utils/grid-ops";
import { styleStateToCell, type AnsiStyleState } from "@/shared/utils/ansi";
import { GridManager } from "@/shared/utils/grid";
import { isWideCell } from "@/shared/metrics";

type CellWriteOptions = {
  preserveTargetBackground?: boolean;
};

const resolveTargetBackground = (
  targetGrid: Y.Map<GridCell>,
  x: number,
  y: number
) => {
  const directCell = targetGrid.get(GridManager.toKey(x, y));
  if (directCell) return directCell.bgColor;

  const leftCell = targetGrid.get(GridManager.toKey(x - 1, y));
  return leftCell && isWideCell(leftCell.char) ? leftCell.bgColor : undefined;
};

export const placeCharInMap = (
  targetMap: {
    set(key: string, value: GridCell): void;
    delete(key: string): void;
    get(key: string): GridCell | undefined;
  },
  x: number,
  y: number,
  char: string,
  color: string
) => {
  writeCell(targetMap, x, y, char, color);
};

export const placeStyledCellInYMap = (
  targetGrid: Y.Map<GridCell>,
  x: number,
  y: number,
  char: string,
  style: AnsiStyleState,
  options?: CellWriteOptions
) => {
  const targetBackground = options?.preserveTargetBackground
    ? resolveTargetBackground(targetGrid, x, y)
    : undefined;
  const nextStyle =
    style.bgColor === undefined && targetBackground
      ? { ...style, bgColor: targetBackground }
      : style;
  writeStyledCell(targetGrid, x, y, styleStateToCell(char, nextStyle));
};

export const placeCharInYMap = (
  targetGrid: Y.Map<GridCell>,
  x: number,
  y: number,
  char: string,
  color: string,
  options?: CellWriteOptions
) => {
  placeStyledCellInYMap(targetGrid, x, y, char, { color }, options);
};
