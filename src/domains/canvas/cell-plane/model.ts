import type { GridCell, NodeBounds, Point, TextAttributes } from "@/shared/types";
import {
  getCellOccupancy,
  getTextCellWidth,
  splitGraphemes,
} from "@/shared/metrics";
import { GridManager } from "@/shared/utils/grid";
import { deleteCellAt, writeStyledCell } from "@/shared/utils/grid-ops";
import { resolveGridSlot } from "@/shared/utils/grid-occupancy";

const CELL_PLANE_CHUNK_WIDTH = 128;
const CELL_PLANE_CHUNK_HEIGHT = 64;
const CELL_PLANE_INVALIDATION_HISTORY_LIMIT = 256;
const CELL_PLANE_INVALIDATION_BOUNDS_LIMIT = 64;
const CELL_PLANE_CHUNK_CACHE_LIMIT = 64;

export type GridInterval = { from: number; to: number };

export type StyledCellSpan = {
  x: number;
  text: string;
  color: string;
  bgColor?: string;
  attrs?: TextAttributes;
  href?: string;
  preserveTargetBackground?: boolean;
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

/** Compact, rendering-neutral mutation accepted by the document write port. */
export type CellPlanePatch = {
  rows: readonly CellRowMutation[];
};

const isSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value);

const isTextAttributes = (value: unknown) =>
  value === undefined ||
  (!!value &&
    typeof value === "object" &&
    ["bold", "italic", "underline", "strike", "inverse"].every(
      (key) =>
        !(key in value) ||
        typeof (value as Record<string, unknown>)[key] === "boolean"
    ));

export const isCellPlaneOperation = (
  value: unknown
): value is CellPlaneOperation => {
  if (!value || typeof value !== "object") return false;
  const operation = value as Partial<CellPlaneOperation>;
  const bounds = operation.bounds;
  if (
    typeof operation.id !== "string" ||
    operation.id.length === 0 ||
    !bounds ||
    !isSafeInteger(bounds.x) ||
    !isSafeInteger(bounds.y) ||
    !isSafeInteger(bounds.width) ||
    !isSafeInteger(bounds.height) ||
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    !Array.isArray(operation.rows)
  ) return false;
  return operation.rows.every((candidate: unknown) => {
    const row = candidate as Partial<CellRowMutation>;
    return !!row &&
    isSafeInteger(row.y) &&
    Array.isArray(row.erase) &&
    row.erase.every((interval: unknown) => {
      const value = interval as Partial<GridInterval>;
      return (
        !!value &&
        isSafeInteger(value.from) &&
        isSafeInteger(value.to) &&
        value.from <= value.to
      );
    }) &&
    Array.isArray(row.spans) &&
    row.spans.every((candidateSpan: unknown) => {
      const span = candidateSpan as Partial<StyledCellSpan>;
      return !!span &&
        isSafeInteger(span.x) &&
        typeof span.text === "string" &&
        span.text.length > 0 &&
        typeof span.color === "string" &&
        (span.bgColor === undefined || typeof span.bgColor === "string") &&
        (span.href === undefined || typeof span.href === "string") &&
        (span.preserveTargetBackground === undefined ||
          typeof span.preserveTargetBackground === "boolean") &&
        isTextAttributes(span.attrs);
    });
  });
};

type CellSpan = {
  x: number;
  cells: GridCell[];
};

type CellPlaneChunkMutation = {
  rows: CellRowMutation[];
};

type MutableCellRowMutation = {
  y: number;
  erase: GridInterval[];
  spans: StyledCellSpan[];
};

export type CellPlaneRow = {
  y: number;
  spans: readonly CellSpan[];
};

export interface CanvasSurfaceReader {
  getCell(point: Point): GridCell | undefined;
  query(bounds: NodeBounds): Iterable<CellSpan & { y: number }>;
  rows(bounds?: NodeBounds): Iterable<CellPlaneRow>;
  getContentBounds(): NodeBounds | null;
  materialize(bounds?: NodeBounds): Map<string, GridCell>;
}

export type CanvasSurfaceChanges =
  | { revision: number; full: true }
  | { revision: number; full: false; bounds: readonly NodeBounds[] };

/** Optional capability for surfaces that can describe changes since a revision. */
export interface IncrementalCanvasSurfaceReader extends CanvasSurfaceReader {
  getRevision(): number;
  getChangesSince(revision: number): CanvasSurfaceChanges;
}

interface CanvasSurfaceLineNavigator extends CanvasSurfaceReader {
  getLineOriginX(point: Point): number;
}

export const isIncrementalCanvasSurfaceReader = (
  reader: CanvasSurfaceReader
): reader is IncrementalCanvasSurfaceReader =>
  "getRevision" in reader &&
  typeof reader.getRevision === "function" &&
  "getChangesSince" in reader &&
  typeof reader.getChangesSince === "function";

export const createGridSurfaceReader = (
  grid: ReadonlyMap<string, GridCell>
): CanvasSurfaceReader => getSurfaceGridReader(grid) ?? ({
  getCell: ({ x, y }) => grid.get(GridManager.toKey(x, y)),
  *query(bounds) {
    for (const row of this.rows(bounds)) {
      for (const span of row.spans) yield { ...span, y: row.y };
    }
  },
  *rows(bounds) {
    const rows = new Map<number, Array<{ x: number; cell: GridCell }>>();
    grid.forEach((cell, key) => {
      const point = GridManager.fromKey(key);
      if (
        bounds &&
        (point.x < bounds.x ||
          point.x >= bounds.x + bounds.width ||
          point.y < bounds.y ||
          point.y >= bounds.y + bounds.height)
      ) return;
      const entries = rows.get(point.y) ?? [];
      entries.push({ x: point.x, cell });
      rows.set(point.y, entries);
    });
    for (const [y, entries] of [...rows].sort(([left], [right]) => left - right)) {
      const spans: CellSpan[] = [];
      let spanEnd = -Infinity;
      for (const entry of entries.sort((left, right) => left.x - right.x)) {
        const previous = spans[spans.length - 1];
        if (previous && spanEnd === entry.x) previous.cells.push(entry.cell);
        else spans.push({ x: entry.x, cells: [entry.cell] });
        spanEnd = entry.x + getCellOccupancy(entry.cell.char);
      }
      yield { y, spans };
    }
  },
  getContentBounds() {
    let result: NodeBounds | null = null;
    grid.forEach((cell, key) => {
      const { x, y } = GridManager.fromKey(key);
      result = unionBounds(result, {
        x,
        y,
        width: getCellOccupancy(cell.char),
        height: 1,
      });
    });
    return result;
  },
  materialize(bounds) {
    if (!bounds) return new Map(grid);
    const result = new Map<string, GridCell>();
    for (const row of this.rows(bounds)) {
      for (const span of row.spans) {
        let x = span.x;
        for (const cell of span.cells) {
          result.set(GridManager.toKey(x, row.y), cell);
          x += getCellOccupancy(cell.char);
        }
      }
    }
    return result;
  },
});

const surfaceGridProjectionReaders = new WeakMap<
  ReadonlyMap<string, GridCell>,
  () => CanvasSurfaceReader
>();

export const isSurfaceGridProjection = (
  grid: ReadonlyMap<string, GridCell>
) => surfaceGridProjectionReaders.has(grid);

export const getSurfaceGridReader = (
  grid: ReadonlyMap<string, GridCell>
): CanvasSurfaceReader | null => surfaceGridProjectionReaders.get(grid)?.() ?? null;

export const getSurfaceGridLineOriginX = (
  grid: ReadonlyMap<string, GridCell>,
  point: Point
) => {
  const reader = surfaceGridProjectionReaders.get(grid)?.();
  return reader && "getLineOriginX" in reader &&
    typeof reader.getLineOriginX === "function"
    ? (reader as CanvasSurfaceLineNavigator).getLineOriginX(point)
    : undefined;
};

/** Map-compatible, non-owning facade for legacy interaction consumers. */
export const createSurfaceGridProjection = (
  source: CanvasSurfaceReader | (() => CanvasSurfaceReader)
): Map<string, GridCell> => {
  const grid = new Map<string, GridCell>();
  const reader = () => typeof source === "function" ? source() : source;
  const materialize = () => reader().materialize();
  const rejectMutation = () => {
    throw new Error("Canvas surface projections are read-only");
  };
  Object.defineProperties(grid, {
    size: { get: () => materialize().size },
    get: {
      value: (key: string) => reader().getCell(GridManager.fromKey(key)),
    },
    has: {
      value: (key: string) => reader().getCell(GridManager.fromKey(key)) !== undefined,
    },
    entries: { value: () => materialize().entries() },
    keys: { value: () => materialize().keys() },
    values: { value: () => materialize().values() },
    [Symbol.iterator]: { value: () => materialize().entries() },
    forEach: {
      value: (
        callbackfn: (value: GridCell, key: string, map: Map<string, GridCell>) => void,
        thisArg?: unknown
      ) => {
        for (const [key, value] of materialize()) {
          callbackfn.call(thisArg, value, key, grid);
        }
      },
    },
    set: { value: rejectMutation },
    delete: { value: rejectMutation },
    clear: { value: rejectMutation },
  });
  surfaceGridProjectionReaders.set(grid, reader);
  return grid;
};

const floorDiv = (value: number, divisor: number) => Math.floor(value / divisor);
const chunkKey = (x: number, y: number) => `${x},${y}`;

const intersects = (left: NodeBounds, right: NodeBounds) =>
  left.x < right.x + right.width &&
  left.x + left.width > right.x &&
  left.y < right.y + right.height &&
  left.y + left.height > right.y;

const touches = (left: NodeBounds, right: NodeBounds) =>
  left.x <= right.x + right.width &&
  left.x + left.width >= right.x &&
  left.y <= right.y + right.height &&
  left.y + left.height >= right.y;

const unionBounds = (left: NodeBounds | null, right: NodeBounds) => {
  if (!left) return { ...right };
  const minX = Math.min(left.x, right.x);
  const minY = Math.min(left.y, right.y);
  const maxX = Math.max(left.x + left.width, right.x + right.width);
  const maxY = Math.max(left.y + left.height, right.y + right.height);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

const toCell = (
  span: StyledCellSpan,
  char: string,
  targetBackground?: string
): GridCell => ({
  char,
  color: span.color,
  ...(span.bgColor
    ? { bgColor: span.bgColor }
    : span.preserveTargetBackground && targetBackground
      ? { bgColor: targetBackground }
      : {}),
  ...(span.attrs ? { attrs: { ...span.attrs } } : {}),
  ...(span.href ? { href: span.href } : {}),
});

export const cellPlanePatchToOperation = (
  id: string,
  patch: CellPlanePatch
): CellPlaneOperation | null => {
  let bounds: NodeBounds | null = null;
  for (const row of patch.rows) {
    for (const interval of row.erase) {
      bounds = unionBounds(bounds, {
        x: interval.from,
        y: row.y,
        width: interval.to - interval.from + 1,
        height: 1,
      });
    }
    for (const span of row.spans) {
      const width = getTextCellWidth(span.text);
      if (width <= 0) continue;
      bounds = unionBounds(bounds, {
        x: span.x,
        y: row.y,
        width,
        height: 1,
      });
    }
  }
  if (!bounds) return null;
  return { id, bounds, rows: patch.rows };
};

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
export class CellPlaneIndex implements CanvasSurfaceReader {
  readonly #mutationsByChunk = new Map<string, CellPlaneChunkMutation[]>();
  readonly #chunkXsByRow = new Map<number, Set<number>>();
  readonly #chunkCache = new Map<string, Map<string, GridCell>>();
  #contentBounds: NodeBounds | null = null;
  #resolvedContentBounds: NodeBounds | null | undefined = null;
  #revision = 0;
  readonly #invalidations: Array<{ revision: number; bounds: NodeBounds }> = [];

  constructor(operations: readonly CellPlaneOperation[] = []) {
    operations.forEach((operation) => this.append(operation));
  }

  append(operation: CellPlaneOperation) {
    if (!isCellPlaneOperation(operation)) return;
    this.#revision += 1;
    this.#invalidations.push({
      revision: this.#revision,
      bounds: { ...operation.bounds },
    });
    if (this.#invalidations.length > CELL_PLANE_INVALIDATION_HISTORY_LIMIT) {
      this.#invalidations.shift();
    }
    this.#compileChunkMutations(operation);
    const previousBounds = this.#contentBounds;
    this.#contentBounds = unionBounds(this.#contentBounds, operation.bounds);
    this.#resolvedContentBounds =
      operation.rows.some((row) => row.erase.length > 0) ||
      (!!previousBounds && intersects(previousBounds, operation.bounds))
      ? undefined
      : this.#resolvedContentBounds === undefined
        ? undefined
        : unionBounds(this.#resolvedContentBounds, operation.bounds);
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
        this.#chunkCache.delete(key);
      }
    }
  }

  getRevision() {
    return this.#revision;
  }

  getChangesSince(revision: number): CanvasSurfaceChanges {
    if (!Number.isSafeInteger(revision) || revision < 0 || revision > this.#revision) {
      return { revision: this.#revision, full: true };
    }
    if (revision === this.#revision) {
      return { revision: this.#revision, full: false, bounds: [] };
    }
    const oldestRevision = this.#invalidations[0]?.revision ?? this.#revision;
    if (revision < oldestRevision - 1) {
      return { revision: this.#revision, full: true };
    }

    const bounds: NodeBounds[] = [];
    for (const invalidation of this.#invalidations) {
      if (invalidation.revision <= revision) continue;
      let merged = { ...invalidation.bounds };
      for (let index = 0; index < bounds.length;) {
        if (!touches(bounds[index]!, merged)) {
          index += 1;
          continue;
        }
        merged = unionBounds(bounds[index]!, merged);
        bounds.splice(index, 1);
        index = 0;
      }
      bounds.push(merged);
      if (bounds.length > CELL_PLANE_INVALIDATION_BOUNDS_LIMIT) {
        return { revision: this.#revision, full: true };
      }
    }
    return { revision: this.#revision, full: false, bounds };
  }

  getLineOriginX(point: Point) {
    let seedX: number | null = null;
    const maxChunkX = floorDiv(point.x + 1, CELL_PLANE_CHUNK_WIDTH);
    for (const chunkX of this.#chunkXsByRow.get(point.y) ?? []) {
      if (chunkX > maxChunkX) continue;
      const chunk = this.#resolveChunk(
        chunkX,
        floorDiv(point.y, CELL_PLANE_CHUNK_HEIGHT)
      );
      for (const key of chunk.keys()) {
        const candidate = GridManager.fromKey(key);
        if (
          candidate.y === point.y &&
          candidate.x <= point.x &&
          (seedX === null || candidate.x > seedX)
        ) seedX = candidate.x;
      }
    }
    if (seedX === null) return point.x;

    let runStartX = seedX;
    while (true) {
      const immediate = this.getCell({ x: runStartX - 1, y: point.y });
      if (immediate && getCellOccupancy(immediate.char) === 1) {
        runStartX -= 1;
        continue;
      }
      const wide = this.getCell({ x: runStartX - 2, y: point.y });
      if (wide && getCellOccupancy(wide.char) === 2) {
        runStartX -= 2;
        continue;
      }
      break;
    }
    return Math.min(point.x, runStartX);
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
    if (this.#resolvedContentBounds !== undefined) {
      return this.#resolvedContentBounds
        ? { ...this.#resolvedContentBounds }
        : null;
    }
    if (!this.#contentBounds) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const row of this.rows(this.#contentBounds)) {
      for (const span of row.spans) {
        let x = span.x;
        for (const cell of span.cells) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, row.y);
          x += getCellOccupancy(cell.char);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, row.y + 1);
        }
      }
    }
    this.#resolvedContentBounds = Number.isFinite(minX)
      ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
      : null;
    return this.#resolvedContentBounds
      ? { ...this.#resolvedContentBounds }
      : null;
  }

  materialize(bounds = this.#contentBounds ?? undefined) {
    const grid = new Map<string, GridCell>();
    if (!bounds) return grid;
    for (const row of this.rows(bounds)) {
      for (const span of row.spans) {
        let x = span.x;
        for (const cell of span.cells) {
          grid.set(GridManager.toKey(x, row.y), cell);
          x += getCellOccupancy(cell.char);
        }
      }
    }
    return grid;
  }

  dispose() {
    this.#mutationsByChunk.clear();
    this.#chunkXsByRow.clear();
    this.#chunkCache.clear();
    this.#invalidations.length = 0;
    this.#contentBounds = null;
    this.#resolvedContentBounds = null;
  }

  #compileChunkMutations(operation: CellPlaneOperation) {
    const rowsByChunk = new Map<string, Map<number, MutableCellRowMutation>>();
    const getRow = (chunkX: number, y: number) => {
      const key = chunkKey(chunkX, floorDiv(y, CELL_PLANE_CHUNK_HEIGHT));
      const rows = rowsByChunk.get(key) ?? new Map<number, MutableCellRowMutation>();
      let row = rows.get(y);
      if (!row) {
        row = { y, erase: [], spans: [] };
        rows.set(y, row);
        rowsByChunk.set(key, rows);
        const chunkXs = this.#chunkXsByRow.get(y) ?? new Set<number>();
        chunkXs.add(chunkX);
        this.#chunkXsByRow.set(y, chunkXs);
      }
      return row;
    };

    for (const row of operation.rows) {
      for (const interval of row.erase) {
        const minChunkX = floorDiv(interval.from - 1, CELL_PLANE_CHUNK_WIDTH);
        const maxChunkX = floorDiv(interval.to + 1, CELL_PLANE_CHUNK_WIDTH);
        for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
          getRow(chunkX, row.y).erase.push({ ...interval });
        }
      }
      for (const span of row.spans) {
        const spansByChunk = new Map<
          number,
          { x: number; text: string[] }
        >();
        let x = span.x;
        for (const char of splitGraphemes(span.text)) {
          const width = getCellOccupancy(char);
          const minChunkX = floorDiv(x - 1, CELL_PLANE_CHUNK_WIDTH);
          const maxChunkX = floorDiv(x + width, CELL_PLANE_CHUNK_WIDTH);
          for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
            const compiled = spansByChunk.get(chunkX);
            if (compiled) compiled.text.push(char);
            else spansByChunk.set(chunkX, { x, text: [char] });
          }
          x += width;
        }
        spansByChunk.forEach((compiled, chunkX) => {
          getRow(chunkX, row.y).spans.push({
            ...span,
            x: compiled.x,
            text: compiled.text.join(""),
          });
        });
      }
    }

    for (const [key, rows] of rowsByChunk) {
      const mutations = this.#mutationsByChunk.get(key) ?? [];
      mutations.push({ rows: [...rows.values()] });
      this.#mutationsByChunk.set(key, mutations);
    }
  }

  #resolveChunk(chunkX: number, chunkY: number) {
    const key = chunkKey(chunkX, chunkY);
    const cached = this.#chunkCache.get(key);
    if (cached) {
      this.#chunkCache.delete(key);
      this.#chunkCache.set(key, cached);
      return cached;
    }
    const chunkBounds = {
      x: chunkX * CELL_PLANE_CHUNK_WIDTH,
      y: chunkY * CELL_PLANE_CHUNK_HEIGHT,
      width: CELL_PLANE_CHUNK_WIDTH,
      height: CELL_PLANE_CHUNK_HEIGHT,
    };
    const projection = new Map<string, GridCell>();
    for (const mutation of this.#mutationsByChunk.get(key) ?? []) {
      for (const row of mutation.rows) {
        for (const interval of row.erase) {
          const from = Math.max(interval.from, chunkBounds.x - 1);
          const to = Math.min(interval.to, chunkBounds.x + chunkBounds.width);
          for (let x = from; x <= to; x += 1) deleteCellAt(projection, x, row.y);
        }
        for (const span of row.spans) {
          let x = span.x;
          for (const char of splitGraphemes(span.text)) {
            const targetBackground = span.preserveTargetBackground
              ? resolveGridSlot(projection, { x, y: row.y })?.cell.bgColor
              : undefined;
            writeStyledCell(
              projection,
              x,
              row.y,
              toCell(span, char, targetBackground)
            );
            x += getCellOccupancy(char);
          }
        }
      }
    }
    this.#chunkCache.set(key, projection);
    if (this.#chunkCache.size > CELL_PLANE_CHUNK_CACHE_LIMIT) {
      this.#chunkCache.delete(this.#chunkCache.keys().next().value!);
    }
    return projection;
  }
}
