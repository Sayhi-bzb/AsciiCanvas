import { describe, expect, it, vi } from "vitest";
import {
  CellPlaneIndex,
  cellPlanePatchToOperation,
} from "@/domains/canvas/public";
import type { CanvasRenderWorkerClient } from "./CanvasRenderWorkerClient";
import {
  CanvasRasterTileCache,
  getCanvasRasterTileShape,
  getCanvasRasterZoomBucket,
} from "./CanvasRasterTileCache";

const operation = (id: string, x: number, text: string) =>
  cellPlanePatchToOperation(id, {
    rows: [{ y: 2, erase: [], spans: [{ x, text, color: "#fff" }] }],
  })!;

const createWorker = () => ({
  retain: vi.fn(() => () => undefined),
  renderTiles: vi.fn(() => new Promise(() => undefined)),
  project: vi.fn(() => null),
  cancelPane: vi.fn(),
}) as unknown as CanvasRenderWorkerClient;

const viewBounds = { startX: 0, endX: 20, startY: 0, endY: 10 };
const context = {} as CanvasRenderingContext2D;

describe("CanvasRasterTileCache geometry", () => {
  it("uses stable zoom buckets", () => {
    expect(getCanvasRasterZoomBucket(1.001)).toBe(1);
    expect(getCanvasRasterZoomBucket(0.49)).toBe(0.484375);
    expect(getCanvasRasterZoomBucket(0.1)).toBe(0.125);
  });

  it("keeps raster tiles inside bounded device dimensions", () => {
    for (const zoom of [0.125, 0.25, 0.5, 1, 2, 4]) {
      const shape = getCanvasRasterTileShape(zoom, 2);
      const width = shape.columns * 10 * shape.rasterZoom * shape.rasterDpr;
      const height = shape.rows * 20 * shape.rasterZoom * shape.rasterDpr;
      expect(width).toBeLessThanOrEqual(1_280);
      expect(height).toBeLessThanOrEqual(1_280);
      expect(shape.columns).toBeGreaterThanOrEqual(8);
      expect(shape.rows).toBeGreaterThanOrEqual(4);
    }
  });

  it("defers worker batches while the viewport is moving", () => {
    const worker = createWorker();
    const cache = new CanvasRasterTileCache(1024 * 1024, worker);
    const reader = new CellPlaneIndex([operation("initial", 5, "A")]);

    const moving = cache.draw(context, reader, viewBounds, 1, { x: 0, y: 0 }, 1, {
      paneId: "primary",
      mode: "viewport-interaction",
    });
    expect(worker.renderTiles).not.toHaveBeenCalled();
    expect(moving.uncoveredBounds.length).toBeGreaterThan(0);

    cache.draw(context, reader, viewBounds, 1, { x: 0, y: 0 }, 1, {
      paneId: "primary",
      mode: "settled",
    });
    expect(worker.renderTiles).toHaveBeenCalledOnce();
    const request = vi.mocked(worker.renderTiles).mock.calls[0]![1];
    expect(request.tiles.some(({ priority }) => priority === "visible")).toBe(true);
    expect(request.tiles.some(({ priority }) => priority === "prefetch")).toBe(true);
  });

  it("returns a one-cell hot-patch halo for content edits", () => {
    const worker = createWorker();
    const cache = new CanvasRasterTileCache(1024 * 1024, worker);
    const reader = new CellPlaneIndex([operation("initial", 1, "A")]);
    cache.draw(context, reader, viewBounds, 1, { x: 0, y: 0 }, 1, {
      paneId: "primary",
      mode: "content-interaction",
    });

    reader.append(operation("wide", 5, "界"));
    const result = cache.draw(
      context,
      reader,
      viewBounds,
      1,
      { x: 0, y: 0 },
      1,
      { paneId: "primary", mode: "content-interaction" }
    );

    expect(result.patchBounds).toEqual([
      expect.objectContaining({ x: 4, y: 1 }),
    ]);
    expect(result.patchBounds[0]!.x + result.patchBounds[0]!.width).toBeGreaterThan(6);
    expect(worker.renderTiles).not.toHaveBeenCalled();
  });
});
