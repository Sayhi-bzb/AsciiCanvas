import * as Y from "yjs";
import type { GridCell } from "@/shared/types";
import { writeCell } from "@/shared/utils/grid-ops";

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

export const placeCharInYMap = (
  targetGrid: Y.Map<GridCell>,
  x: number,
  y: number,
  char: string,
  color: string
) => {
  writeCell(targetGrid, x, y, char, color);
};
