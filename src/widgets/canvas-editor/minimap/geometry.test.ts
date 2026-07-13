import { describe, expect, it } from "vitest";
import type { GridMap } from "@/shared/types";
import { GridManager } from "@/shared/utils/grid";
import {
  computeMinimapMeta,
  computeMinimapDimensions,
  computeViewportRect,
  intersectViewportRect,
  minimapPointToGrid,
} from "./geometry";

const cell = (char: string, bgColor?: string) => ({
  char,
  color: "#ffffff",
  bgColor,
});

describe("minimap geometry", () => {
  it("preserves canvas cell aspect ratio and centers visible content", () => {
    const grid: GridMap = new Map([
      [GridManager.toKey(0, 0), cell("A")],
      [GridManager.toKey(9, 9), cell("B")],
    ]);

    const dimensions = computeMinimapDimensions(grid, 220, 96, 4);
    const meta = computeMinimapMeta(grid, dimensions, 4);

    expect(dimensions).toEqual({ width: 108, height: 220 });
    expect(meta.valid).toBe(true);
    expect(meta.contentWidth).toBe(90);
    expect(meta.contentHeight).toBe(190);
    expect(meta.contentRect.width / meta.contentRect.height).toBeCloseTo(
      90 / 190
    );
    expect(meta.contentRect.x).toBeCloseTo(
      (dimensions.width - meta.contentRect.width) / 2
    );
    expect(meta.contentRect.y).toBeCloseTo(
      (dimensions.height - meta.contentRect.height) / 2
    );
  });

  it("uses the maximum long edge and minimum short edge for extreme content", () => {
    const horizontal: GridMap = new Map([
      [GridManager.toKey(0, 0), cell("A")],
      [GridManager.toKey(99, 0), cell("B")],
    ]);
    const vertical: GridMap = new Map([
      [GridManager.toKey(0, 0), cell("A")],
      [GridManager.toKey(0, 99), cell("B")],
    ]);

    expect(computeMinimapDimensions(horizontal, 220, 96, 4)).toEqual({
      width: 220,
      height: 96,
    });
    expect(computeMinimapDimensions(vertical, 220, 96, 4)).toEqual({
      width: 96,
      height: 220,
    });
    expect(computeMinimapDimensions(new Map(), 220, 96, 4)).toEqual({
      width: 96,
      height: 96,
    });
  });

  it("ignores blank foreground-only cells when computing bounds", () => {
    const grid: GridMap = new Map([
      [GridManager.toKey(-100, -100), cell(" ")],
      [GridManager.toKey(2, 3), cell("A")],
      [GridManager.toKey(4, 5), cell(" ", "#222222")],
    ]);

    const meta = computeMinimapMeta(grid, { width: 220, height: 220 }, 8);

    expect(meta.minX).toBe(2);
    expect(meta.minY).toBe(3);
    expect(meta.maxX).toBe(4);
    expect(meta.maxY).toBe(5);
  });

  it("includes wide-character occupancy in content width", () => {
    const grid: GridMap = new Map([
      [GridManager.toKey(4, 2), cell("你")],
    ]);

    const meta = computeMinimapMeta(grid, { width: 220, height: 220 }, 8);

    expect(meta.minX).toBe(4);
    expect(meta.maxX).toBe(5);
    expect(meta.contentWidth).toBe(18);
  });

  it("clamps minimap points to content before converting to grid space", () => {
    const grid: GridMap = new Map([
      [GridManager.toKey(10, 20), cell("A")],
      [GridManager.toKey(19, 29), cell("B")],
    ]);
    const meta = computeMinimapMeta(grid, { width: 220, height: 220 }, 8);

    expect(minimapPointToGrid({ x: -50, y: -50 }, meta)).toEqual({
      x: 10,
      y: 20,
    });
    expect(minimapPointToGrid({ x: 500, y: 500 }, meta)).toEqual({
      x: 19,
      y: 29,
    });

    const point = {
      x: meta.originX + 4.5 * 9 * meta.scale,
      y: meta.originY + 6.5 * 19 * meta.scale,
    };
    const target = minimapPointToGrid(point, meta);
    expect(target.x).toBeCloseTo(14.5);
    expect(target.y).toBeCloseTo(26.5);
  });

  it("computes viewport geometry in the same canvas-pixel coordinate space", () => {
    const grid: GridMap = new Map([
      [GridManager.toKey(0, 0), cell("A")],
      [GridManager.toKey(99, 99), cell("B")],
    ]);
    const meta = computeMinimapMeta(grid, { width: 220, height: 220 }, 8);
    const viewport = computeViewportRect(
      { x: -90, y: -190 },
      1,
      { width: 90, height: 190 },
      meta
    );

    expect(viewport.x).toBeCloseTo(meta.originX + 90 * meta.scale);
    expect(viewport.y).toBeCloseTo(meta.originY + 190 * meta.scale);
    expect(viewport.width).toBeCloseTo(90 * meta.scale);
    expect(viewport.height).toBeCloseTo(190 * meta.scale);
  });

  it("clips viewport rectangles instead of pinning them to an edge", () => {
    const bounds = { x: 10, y: 20, width: 100, height: 80 };

    expect(
      intersectViewportRect({ x: 0, y: 30, width: 30, height: 20 }, bounds)
    ).toEqual({ x: 10, y: 30, width: 20, height: 20 });
    expect(
      intersectViewportRect({ x: -50, y: -50, width: 20, height: 20 }, bounds)
    ).toBeNull();
  });
});
