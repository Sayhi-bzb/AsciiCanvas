import type { Point, GridMap } from "@/shared/types";
import {
  getCellOccupancy,
  gridToScreen,
  screenToGrid,
  getViewportGridBounds,
} from "@/shared/metrics";
import { resolveGridAnchor } from "@/shared/utils/grid-occupancy";

export const GridManager = {
  screenToGrid(
    screenX: number,
    screenY: number,
    offsetX: number,
    offsetY: number,
    zoom: number
  ): Point {
    return screenToGrid(screenX, screenY, {
      offset: { x: offsetX, y: offsetY },
      zoom,
    });
  },

  gridToScreen(
    gridX: number,
    gridY: number,
    offsetX: number,
    offsetY: number,
    zoom: number
  ): Point {
    return gridToScreen(gridX, gridY, {
      offset: { x: offsetX, y: offsetY },
      zoom,
    });
  },

  toKey(x: number, y: number): string {
    return `${x},${y}`;
  },

  fromKey(key: string): Point {
    const [x, y] = key.split(",").map(Number);
    return { x, y };
  },

  iterate<T>(
    container: { forEach: (cb: (value: T, key: string) => void) => void },
    callback: (value: T, x: number, y: number) => void
  ): void {
    container.forEach((value, key) => {
      const { x, y } = this.fromKey(key);
      callback(value, x, y);
    });
  },

  getCharWidth(char: string): number {
    return getCellOccupancy(char);
  },

  isWideChar(char: string): boolean {
    return this.getCharWidth(char) === 2;
  },

  snapToCharStart(pos: Point, grid: GridMap): Point {
    return resolveGridAnchor(grid, pos);
  },

  getGridBounds(grid: GridMap) {
    if (grid.size === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    this.iterate(grid, (cell, x, y) => {
      const width = this.getCharWidth(cell.char);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + width - 1);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });

    return { minX, maxX, minY, maxY };
  },

  getViewportGridBounds(
    width: number,
    height: number,
    offsetX: number,
    offsetY: number,
    zoom: number
  ) {
    return getViewportGridBounds(width, height, {
      offset: { x: offsetX, y: offsetY },
      zoom,
    });
  },
};
