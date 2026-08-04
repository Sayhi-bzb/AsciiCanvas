import type { GridMap, Point } from "@/shared/types";
import { getCellOccupancy } from "@/shared/metrics";
import { GridManager } from "@/shared/utils/grid";

export interface CanvasLinkHit {
  y: number;
  startX: number;
  endX: number;
  href: string;
}

const getLinkedCellWidth = (grid: GridMap, x: number, y: number, href: string) => {
  const cell = grid.get(GridManager.toKey(x, y));
  return cell?.href === href ? getCellOccupancy(cell.char) : 0;
};

const resolveLinkedRun = (grid: GridMap, point: Point, href: string) => {
  let startX = point.x;
  while (startX > Number.MIN_SAFE_INTEGER) {
    const leftX = startX - 1;
    const leftAnchor = GridManager.snapToCharStart({ x: leftX, y: point.y }, grid);
    if (leftAnchor.x >= startX) break;
    const width = getLinkedCellWidth(grid, leftAnchor.x, point.y, href);
    if (width === 0 || leftAnchor.x + width !== startX) break;
    startX = leftAnchor.x;
  }

  let endX =
    point.x +
    getCellOccupancy(
      grid.get(GridManager.toKey(point.x, point.y))?.char ?? " "
    ) -
    1;
  while (endX < Number.MAX_SAFE_INTEGER) {
    const nextX = endX + 1;
    const width = getLinkedCellWidth(grid, nextX, point.y, href);
    if (width === 0) break;
    endX = nextX + width - 1;
  }

  return { y: point.y, startX, endX, href };
};

export const resolveCanvasLinkHit = (input: {
  clientX: number;
  clientY: number;
  rect: Pick<DOMRect, "left" | "top">;
  offset: Point;
  zoom: number;
  grid: GridMap;
}): CanvasLinkHit | null => {
  const raw = GridManager.screenToGrid(
    input.clientX - input.rect.left,
    input.clientY - input.rect.top,
    input.offset.x,
    input.offset.y,
    input.zoom
  );
  const point = GridManager.snapToCharStart(raw, input.grid);
  const cell = input.grid.get(GridManager.toKey(point.x, point.y));
  return cell?.href ? resolveLinkedRun(input.grid, point, cell.href) : null;
};
