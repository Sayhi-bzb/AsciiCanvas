import { describe, expect, it } from "vitest";
import {
  getCanvasRasterTileShape,
  getCanvasRasterZoomBucket,
} from "./CanvasRasterTileCache";

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
});
