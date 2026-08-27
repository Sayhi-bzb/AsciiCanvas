import type { CanvasRenderActivityMode } from "../engine/CanvasRenderActivity";

type CanvasTileCoordinate = { x: number; y: number };
export type CanvasTileResidency = "visible" | "warm";

type CanvasResidentTile = CanvasTileCoordinate & {
  residency: CanvasTileResidency;
};

type PaneState = {
  signature: string;
  center: CanvasTileCoordinate;
  direction: CanvasTileCoordinate;
};

const MAX_WARM_TILES = 16;

/** Keeps a bounded, direction-aware ring around each pane's visible tile set. */
export class CanvasViewportResidencyManager {
  readonly #panes = new Map<string, PaneState>();

  update(input: {
    paneId: string;
    signature: string;
    minTileX: number;
    maxTileX: number;
    minTileY: number;
    maxTileY: number;
    mode: CanvasRenderActivityMode;
  }): readonly CanvasResidentTile[] {
    const center = {
      x: (input.minTileX + input.maxTileX) / 2,
      y: (input.minTileY + input.maxTileY) / 2,
    };
    const previous = this.#panes.get(input.paneId);
    const delta = previous?.signature === input.signature
      ? { x: center.x - previous.center.x, y: center.y - previous.center.y }
      : { x: 0, y: 0 };
    const direction = {
      x: Math.sign(delta.x || previous?.direction.x || 0),
      y: Math.sign(delta.y || previous?.direction.y || 0),
    };
    this.#panes.set(input.paneId, { signature: input.signature, center, direction });

    const result: CanvasResidentTile[] = [];
    const visible = new Set<string>();
    for (let y = input.minTileY; y <= input.maxTileY; y += 1) {
      for (let x = input.minTileX; x <= input.maxTileX; x += 1) {
        visible.add(`${x}:${y}`);
        result.push({ x, y, residency: "visible" });
      }
    }

    const candidates: Array<CanvasResidentTile & { score: number }> = [];
    const ahead = input.mode === "viewport-interaction" ? 2 : 1;
    const minX = input.minTileX - 1 + Math.min(0, direction.x * ahead);
    const maxX = input.maxTileX + 1 + Math.max(0, direction.x * ahead);
    const minY = input.minTileY - 1 + Math.min(0, direction.y * ahead);
    const maxY = input.maxTileY + 1 + Math.max(0, direction.y * ahead);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (visible.has(`${x}:${y}`)) continue;
        const projected = (x - center.x) * direction.x + (y - center.y) * direction.y;
        const distance = Math.abs(x - center.x) + Math.abs(y - center.y);
        candidates.push({ x, y, residency: "warm", score: projected * 4 - distance });
      }
    }
    candidates
      .sort((left, right) => right.score - left.score)
      .slice(0, MAX_WARM_TILES)
      .forEach(({ x, y, residency }) => result.push({ x, y, residency }));
    return result;
  }

  release(paneId: string): void {
    this.#panes.delete(paneId);
  }

  clear(): void {
    this.#panes.clear();
  }
}
