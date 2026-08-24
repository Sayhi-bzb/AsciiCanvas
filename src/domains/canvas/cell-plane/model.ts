import type { GridCell, NodeBounds, Point, TextAttributes } from "@/shared/types";
import { getCellOccupancy, splitGraphemes } from "@/shared/metrics";
import { GridManager } from "@/shared/utils/grid";
import { deleteCellAt, writeStyledCell } from "@/shared/utils/grid-ops";

export const CELL_PLANE_CHUNK_WIDTH = 128;
export const CELL_PLANE_CHUNK_HEIGHT = 64;

export type GridInterval = { from: number; to: number };

export type StyledCellSpan = {
  x: number;
  text: string;
  color: string;
  bgColor?: string;
  attrs?: TextAttributes;
  href?: string;
};

export type CellRowMutation = {
  y: number;
  erase: readonly GridInterval[];
  spans: readonly StyledCellSpan[];
};

export type CellPlaneOperation = {
  id: string;
  bounds: NodeBounds;
  rows: readonly CellRowMutation[];
};

export type CellSpan = {
  x: number;
  cells: GridCell[];
};

export type CellPlaneRow = {
  y: number;
  spans: readonly CellSpan[];
};

export interface CellPlaneReader {
  getCell(point: Point): GridCell | undefined;
  query(bounds: NodeBounds): Iterable<CellSpan & { y: number }>;
  rows(bounds?: NodeBounds): Iterable<CellPlaneRow>;
  getContentBounds(): NodeBounds | null;
}

const floorDiv = (value: number, divisor: number) => Math.floor(value / divisor);
const chunkKey = (x: number, y: number) => `${x},${y}`;

const intersects = (left: NodeBounds, right: NodeBounds) =>
  left.x < right.x + right.width &&
  left.x + left.width > right.x &&
  left.y < right.y + right.height &&
  left.y + left.height > right.y;

const unionBounds = (left: NodeBounds | null, right: NodeBounds) => {
  if (!left) return { ...right };
  const minX = Math.min(left.x, right.x);
  const minY = Math.min(left.y, right.y);
  const maxX = Math.max(left.x + left.width, right.x + right.width);
  const maxY = Math.max(left.y + left.height, right.y + right.height);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

const toCell = (span: StyledCellSpan, char: string): GridCell => ({
  char,
  color: span.color,
  ...(span.bgColor ? { bgColor: span.bgColor } : {}),
  ...(span.attrs ? { attrs: { ...span.attrs } } : {}),
  ...(span.href ? { href: span.href } : {}),
});

const sameCellStyle = (left: GridCell, right: GridCell) =>
  left.color === right.color &&
  left.bgColor === right.bgColor &&
  left.href === right.href &&
  left.attrs?.bold === right.attrs?.bold &&
  left.attrs?.italic === right.attrs?.italic &&
  left.attrs?.underline === right.attrs?.underline &&
  left.attrs?.strike === right.attrs?.strike &&
  left.attrs?.inverse === right.attrs?.inverse;

export const gridEntriesToCellPlaneOperation = (
  id: string,
  entries: readonly (readonly [string, GridCell])[]
): CellPlaneOperation | null => {
  const ordered = entries
    .map(([key, cell]) => ({ ...GridManager.fromKey(key), cell }))
    .filter(({ x, y, cell }) =>
      Number.isSafeInteger(x) && Number.isSafeInteger(y) && !!cell.char
    )
    .sort((left, right) => left.y - right.y || left.x - right.x);
  if (ordered.length === 0) return null;
  const rows: Array<{
    y: number;
    erase: GridInterval[];
    spans: StyledCellSpan[];
  }> = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let previousSpanEnd = -Infinity;
  let previousStyleCell: GridCell | null = null;
  for (const entry of ordered) {
    minX = Math.min(minX, entry.x);
    minY = Math.min(minY, entry.y);
    maxX = Math.max(maxX, entry.x + getCellOccupancy(entry.cell.char));
    maxY = Math.max(maxY, entry.y + 1);
    let row = rows[rows.length - 1];
    if (!row || row.y !== entry.y) {
      row = { y: entry.y, erase: [], spans: [] };
      rows.push(row);
      previousSpanEnd = -Infinity;
      previousStyleCell = null;
    }
    const previous = row.spans[row.spans.length - 1];
    if (
      previous &&
      previousStyleCell &&
      previousSpanEnd === entry.x &&
      sameCellStyle(previousStyleCell, entry.cell)
    ) {
      previous.text += entry.cell.char;
      previousSpanEnd += getCellOccupancy(entry.cell.char);
      previousStyleCell = entry.cell;
      continue;
    }
    row.spans.push({
      x: entry.x,
      text: entry.cell.char,
      color: entry.cell.color,
      ...(entry.cell.bgColor ? { bgColor: entry.cell.bgColor } : {}),
      ...(entry.cell.attrs ? { attrs: { ...entry.cell.attrs } } : {}),
      ...(entry.cell.href ? { href: entry.cell.href } : {}),
    });
    previousSpanEnd = entry.x + getCellOccupancy(entry.cell.char);
    previousStyleCell = entry.cell;
  }
  return {
    id,
    bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    rows,
  };
};

export const gridChangesToCellPlaneOperation = (
  id: string,
  changes: ReadonlyMap<string, { before?: GridCell; after?: GridCell }>
): CellPlaneOperation | null => {
  const rowsByY = new Map<number, { erase: GridInterval[]; spans: StyledCellSpan[] }>();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [key, change] of changes) {
    const { x, y } = GridManager.fromKey(key);
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) continue;
    const row = rowsByY.get(y) ?? { erase: [], spans: [] };
    if (change.before && !change.after) {
      const to = x + getCellOccupancy(change.before.char) - 1;
      row.erase.push({ from: x, to });
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, to + 1);
    }
    if (change.after) {
      row.spans.push({
        x,
        text: change.after.char,
        color: change.after.color,
        ...(change.after.bgColor ? { bgColor: change.after.bgColor } : {}),
        ...(change.after.attrs ? { attrs: { ...change.after.attrs } } : {}),
        ...(change.after.href ? { href: change.after.href } : {}),
      });
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + getCellOccupancy(change.after.char));
    }
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y + 1);
    rowsByY.set(y, row);
  }
  if (rowsByY.size === 0 || !Number.isFinite(minX)) return null;
  const rows = [...rowsByY.entries()]
    .sort(([left], [right]) => left - right)
    .map(([y, row]) => {
      const spans: StyledCellSpan[] = [];
      let spanEnd = -Infinity;
      for (const span of row.spans.sort((left, right) => left.x - right.x)) {
        const previous = spans[spans.length - 1];
        if (
          previous &&
          spanEnd === span.x &&
          sameCellStyle(toCell(previous, ""), toCell(span, ""))
        ) {
          previous.text += span.text;
          spanEnd += getCellOccupancy(span.text);
        } else {
          spans.push(span);
          spanEnd = span.x + getCellOccupancy(span.text);
        }
      }
      return {
        y,
        erase: row.erase.sort((left, right) => left.from - right.from),
        spans,
      };
    });
  return {
    id,
    bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    rows,
  };
};

/**
 * Ordered semantic operation index. Yjs owns the operation order; this class is
 * a disposable spatial projection and never writes collaborative state.
 */
export class CellPlaneIndex implements CellPlaneReader {
  readonly #operations: CellPlaneOperation[] = [];
  readonly #operationIndexesByChunk = new Map<string, number[]>();
  readonly #chunkCache = new Map<string, Map<string, GridCell>>();
  #contentBounds: NodeBounds | null = null;

  constructor(operations: readonly CellPlaneOperation[] = []) {
    operations.forEach((operation) => this.append(operation));
  }

  append(operation: CellPlaneOperation) {
    if (operation.bounds.width <= 0 || operation.bounds.height <= 0) return;
    const operationIndex = this.#operations.length;
    this.#operations.push(operation);
    this.#contentBounds = unionBounds(this.#contentBounds, operation.bounds);
    const minChunkX = floorDiv(operation.bounds.x - 1, CELL_PLANE_CHUNK_WIDTH);
    const maxChunkX = floorDiv(
      operation.bounds.x + operation.bounds.width,
      CELL_PLANE_CHUNK_WIDTH
    );
    const minChunkY = floorDiv(operation.bounds.y, CELL_PLANE_CHUNK_HEIGHT);
    const maxChunkY = floorDiv(
      operation.bounds.y + operation.bounds.height - 1,
      CELL_PLANE_CHUNK_HEIGHT
    );
    for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY += 1) {
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
        const key = chunkKey(chunkX, chunkY);
        const indexes = this.#operationIndexesByChunk.get(key) ?? [];
        indexes.push(operationIndex);
        this.#operationIndexesByChunk.set(key, indexes);
        this.#chunkCache.delete(key);
      }
    }
  }

  getCell(point: Point) {
    const chunkX = floorDiv(point.x, CELL_PLANE_CHUNK_WIDTH);
    const chunkY = floorDiv(point.y, CELL_PLANE_CHUNK_HEIGHT);
    return this.#resolveChunk(chunkX, chunkY).get(GridManager.toKey(point.x, point.y));
  }

  *query(bounds: NodeBounds) {
    for (const row of this.rows(bounds)) {
      for (const span of row.spans) yield { ...span, y: row.y };
    }
  }

  *rows(bounds: NodeBounds = this.#contentBounds ?? { x: 0, y: 0, width: 0, height: 0 }) {
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const cellsByRow = new Map<number, Array<{ x: number; cell: GridCell }>>();
    const minChunkX = floorDiv(bounds.x, CELL_PLANE_CHUNK_WIDTH);
    const maxChunkX = floorDiv(bounds.x + bounds.width - 1, CELL_PLANE_CHUNK_WIDTH);
    const minChunkY = floorDiv(bounds.y, CELL_PLANE_CHUNK_HEIGHT);
    const maxChunkY = floorDiv(bounds.y + bounds.height - 1, CELL_PLANE_CHUNK_HEIGHT);
    for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY += 1) {
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
        this.#resolveChunk(chunkX, chunkY).forEach((cell, key) => {
          const point = GridManager.fromKey(key);
          if (
            point.x < chunkX * CELL_PLANE_CHUNK_WIDTH ||
            point.x >= (chunkX + 1) * CELL_PLANE_CHUNK_WIDTH ||
            point.x < bounds.x || point.x >= bounds.x + bounds.width ||
            point.y < bounds.y || point.y >= bounds.y + bounds.height
          ) return;
          const row = cellsByRow.get(point.y) ?? [];
          row.push({ x: point.x, cell });
          cellsByRow.set(point.y, row);
        });
      }
    }
    const sortedRows = [...cellsByRow.entries()].sort(([left], [right]) => left - right);
    for (const [y, entries] of sortedRows) {
      entries.sort((left, right) => left.x - right.x);
      const spans: CellSpan[] = [];
      let spanEnd = -Infinity;
      for (const entry of entries) {
        const previous = spans[spans.length - 1];
        if (previous && spanEnd === entry.x) {
          previous.cells.push(entry.cell);
        } else spans.push({ x: entry.x, cells: [entry.cell] });
        spanEnd = entry.x + getCellOccupancy(entry.cell.char);
      }
      yield { y, spans };
    }
  }

  getContentBounds() {
    return this.#contentBounds ? { ...this.#contentBounds } : null;
  }

  #resolveChunk(chunkX: number, chunkY: number) {
    const key = chunkKey(chunkX, chunkY);
    const cached = this.#chunkCache.get(key);
    if (cached) return cached;
    const chunkBounds = {
      x: chunkX * CELL_PLANE_CHUNK_WIDTH,
      y: chunkY * CELL_PLANE_CHUNK_HEIGHT,
      width: CELL_PLANE_CHUNK_WIDTH,
      height: CELL_PLANE_CHUNK_HEIGHT,
    };
    const projection = new Map<string, GridCell>();
    for (const operationIndex of this.#operationIndexesByChunk.get(key) ?? []) {
      const operation = this.#operations[operationIndex];
      if (!operation || !intersects(operation.bounds, chunkBounds)) continue;
      for (const row of operation.rows) {
        if (row.y < chunkBounds.y || row.y >= chunkBounds.y + chunkBounds.height) continue;
        for (const interval of row.erase) {
          const from = Math.max(interval.from, chunkBounds.x - 1);
          const to = Math.min(interval.to, chunkBounds.x + chunkBounds.width);
          for (let x = from; x <= to; x += 1) deleteCellAt(projection, x, row.y);
        }
        for (const span of row.spans) {
          let x = span.x;
          for (const char of splitGraphemes(span.text)) {
            const width = getCellOccupancy(char);
            if (
              x + width > chunkBounds.x - 1 &&
              x < chunkBounds.x + chunkBounds.width + 1
            ) writeStyledCell(projection, x, row.y, toCell(span, char));
            x += width;
          }
        }
      }
    }
    this.#chunkCache.set(key, projection);
    return projection;
  }
}
