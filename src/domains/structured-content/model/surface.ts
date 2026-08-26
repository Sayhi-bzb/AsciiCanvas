import type { GridCell, NodeBounds, Point } from "@/shared/types";
import { getCellOccupancy } from "@/shared/metrics";
import { GridManager } from "@/shared/utils/grid";
import { getStructuredNodeBounds, renderStructuredScene } from "./scene";
import type { StructuredNode } from "./types";

const CHUNK_WIDTH = 128;
const CHUNK_HEIGHT = 64;
const CHUNK_CACHE_LIMIT = 64;
const MAX_BUCKETS_PER_NODE = 256;

type SurfaceSpan = { x: number; cells: GridCell[] };
type SurfaceRow = { y: number; spans: readonly SurfaceSpan[] };

export type StructuredSurfaceStats = {
  indexDurationMs: number;
  residentChunks: number;
  projectedCells: number;
  resolvedChunks: number;
  materializations: number;
  projectionDurationMs: number;
  maxProjectionDurationMs: number;
};

export interface StructuredSceneSurface {
  getCell(point: Point): GridCell | undefined;
  query(bounds: NodeBounds): Iterable<SurfaceSpan & { y: number }>;
  rows(bounds?: NodeBounds): Iterable<SurfaceRow>;
  getContentBounds(): NodeBounds | null;
  materialize(bounds?: NodeBounds): Map<string, GridCell>;
  getStats(): StructuredSurfaceStats;
  dispose(): void;
}

const floorDiv = (value: number, divisor: number) => Math.floor(value / divisor);
const chunkKey = (x: number, y: number) => `${x},${y}`;

const unionBounds = (left: NodeBounds | null, right: NodeBounds): NodeBounds => {
  if (!left) return { ...right };
  const minX = Math.min(left.x, right.x);
  const minY = Math.min(left.y, right.y);
  const maxX = Math.max(left.x + left.width, right.x + right.width);
  const maxY = Math.max(left.y + left.height, right.y + right.height);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

const intersects = (left: NodeBounds, right: NodeBounds) =>
  left.x < right.x + right.width &&
  left.x + left.width > right.x &&
  left.y < right.y + right.height &&
  left.y + left.height > right.y;

/** Lazily projects only structured nodes intersecting requested cell-plane chunks. */
export class StructuredSceneSurfaceIndex implements StructuredSceneSurface {
  readonly #scene: readonly StructuredNode[];
  readonly #nodesById = new Map<string, StructuredNode>();
  readonly #nodeIdsByChunk = new Map<string, Set<string>>();
  readonly #largeNodeIds = new Set<string>();
  readonly #chunkCache = new Map<string, Map<string, GridCell>>();
  readonly #contentBounds: NodeBounds | null;
  readonly #indexDurationMs: number;
  #projectedCells = 0;
  #resolvedChunks = 0;
  #materializations = 0;
  #projectionDurationMs = 0;
  #maxProjectionDurationMs = 0;

  constructor(scene: readonly StructuredNode[]) {
    const startedAt = performance.now();
    this.#scene = scene;
    let contentBounds: NodeBounds | null = null;
    scene.forEach((node) => {
      this.#nodesById.set(node.id, node);
      const bounds = getStructuredNodeBounds(node);
      contentBounds = unionBounds(contentBounds, bounds);
      const minChunkX = floorDiv(bounds.x, CHUNK_WIDTH);
      const maxChunkX = floorDiv(bounds.x + bounds.width - 1, CHUNK_WIDTH);
      const minChunkY = floorDiv(bounds.y, CHUNK_HEIGHT);
      const maxChunkY = floorDiv(bounds.y + bounds.height - 1, CHUNK_HEIGHT);
      const bucketCount =
        (maxChunkX - minChunkX + 1) * (maxChunkY - minChunkY + 1);
      if (bucketCount > MAX_BUCKETS_PER_NODE) {
        this.#largeNodeIds.add(node.id);
        return;
      }
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY += 1) {
        for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
          const key = chunkKey(chunkX, chunkY);
          const ids = this.#nodeIdsByChunk.get(key) ?? new Set<string>();
          ids.add(node.id);
          this.#nodeIdsByChunk.set(key, ids);
        }
      }
    });
    this.#contentBounds = contentBounds;
    this.#indexDurationMs = performance.now() - startedAt;
  }

  getCell(point: Point) {
    return this.#resolveChunk(
      floorDiv(point.x, CHUNK_WIDTH),
      floorDiv(point.y, CHUNK_HEIGHT)
    ).get(GridManager.toKey(point.x, point.y));
  }

  *query(bounds: NodeBounds) {
    for (const row of this.rows(bounds)) {
      for (const span of row.spans) yield { ...span, y: row.y };
    }
  }

  *rows(bounds: NodeBounds = this.#contentBounds ?? { x: 0, y: 0, width: 0, height: 0 }) {
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const cellsByRow = new Map<number, Array<{ x: number; cell: GridCell }>>();
    const minChunkX = floorDiv(bounds.x, CHUNK_WIDTH);
    const maxChunkX = floorDiv(bounds.x + bounds.width - 1, CHUNK_WIDTH);
    const minChunkY = floorDiv(bounds.y, CHUNK_HEIGHT);
    const maxChunkY = floorDiv(bounds.y + bounds.height - 1, CHUNK_HEIGHT);
    for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY += 1) {
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
        this.#resolveChunk(chunkX, chunkY).forEach((cell, key) => {
          const point = GridManager.fromKey(key);
          if (
            point.x < bounds.x || point.x >= bounds.x + bounds.width ||
            point.y < bounds.y || point.y >= bounds.y + bounds.height
          ) return;
          const row = cellsByRow.get(point.y) ?? [];
          row.push({ x: point.x, cell });
          cellsByRow.set(point.y, row);
        });
      }
    }
    for (const [y, entries] of [...cellsByRow].sort(([a], [b]) => a - b)) {
      entries.sort((a, b) => a.x - b.x);
      const spans: SurfaceSpan[] = [];
      let spanEnd = -Infinity;
      entries.forEach((entry) => {
        const previous = spans[spans.length - 1];
        if (previous && spanEnd === entry.x) previous.cells.push(entry.cell);
        else spans.push({ x: entry.x, cells: [entry.cell] });
        spanEnd = entry.x + getCellOccupancy(entry.cell.char);
      });
      yield { y, spans };
    }
  }

  getContentBounds() {
    return this.#contentBounds ? { ...this.#contentBounds } : null;
  }

  materialize(bounds = this.#contentBounds ?? undefined) {
    this.#materializations += 1;
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

  getStats(): StructuredSurfaceStats {
    return {
      indexDurationMs: this.#indexDurationMs,
      residentChunks: this.#chunkCache.size,
      projectedCells: this.#projectedCells,
      resolvedChunks: this.#resolvedChunks,
      materializations: this.#materializations,
      projectionDurationMs: this.#projectionDurationMs,
      maxProjectionDurationMs: this.#maxProjectionDurationMs,
    };
  }

  dispose() {
    this.#chunkCache.clear();
    this.#nodeIdsByChunk.clear();
    this.#largeNodeIds.clear();
    this.#nodesById.clear();
  }

  #resolveChunk(chunkX: number, chunkY: number) {
    const key = chunkKey(chunkX, chunkY);
    const cached = this.#chunkCache.get(key);
    if (cached) {
      this.#chunkCache.delete(key);
      this.#chunkCache.set(key, cached);
      return cached;
    }
    const startedAt = performance.now();
    const bounds = {
      x: chunkX * CHUNK_WIDTH,
      y: chunkY * CHUNK_HEIGHT,
      width: CHUNK_WIDTH,
      height: CHUNK_HEIGHT,
    };
    const candidateIds = new Set(this.#nodeIdsByChunk.get(key) ?? []);
    this.#largeNodeIds.forEach((id) => {
      const node = this.#nodesById.get(id);
      if (node && intersects(getStructuredNodeBounds(node), bounds)) candidateIds.add(id);
    });
    const candidates = this.#scene.filter((node) => candidateIds.has(node.id));
    const expandedBounds = {
      x: bounds.x - 1,
      y: bounds.y,
      width: bounds.width + 2,
      height: bounds.height,
    };
    const rendered = renderStructuredScene(candidates, expandedBounds);
    const projection = new Map<string, GridCell>();
    rendered.forEach((cell, cellKey) => {
      const point = GridManager.fromKey(cellKey);
      if (
        point.x >= bounds.x && point.x < bounds.x + bounds.width &&
        point.y >= bounds.y && point.y < bounds.y + bounds.height
      ) projection.set(cellKey, cell);
    });
    this.#resolvedChunks += 1;
    this.#projectedCells += projection.size;
    const duration = performance.now() - startedAt;
    this.#projectionDurationMs += duration;
    this.#maxProjectionDurationMs = Math.max(this.#maxProjectionDurationMs, duration);
    this.#chunkCache.set(key, projection);
    if (this.#chunkCache.size > CHUNK_CACHE_LIMIT) {
      this.#chunkCache.delete(this.#chunkCache.keys().next().value!);
    }
    return projection;
  }
}

export const createStructuredSceneSurface = (scene: readonly StructuredNode[]) =>
  new StructuredSceneSurfaceIndex(scene);
