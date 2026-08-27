import { describe, expect, it } from "vitest";
import { CanvasViewportResidencyManager } from "./CanvasViewportResidencyManager";

describe("CanvasViewportResidencyManager", () => {
  it("keeps visible tiles and a bounded warm ring", () => {
    const manager = new CanvasViewportResidencyManager();
    const tiles = manager.update({
      paneId: "primary",
      signature: "source:shape",
      minTileX: 0,
      maxTileX: 1,
      minTileY: 0,
      maxTileY: 1,
      mode: "settled",
    });
    expect(tiles.filter(({ residency }) => residency === "visible")).toHaveLength(4);
    expect(tiles.filter(({ residency }) => residency === "warm").length).toBeLessThanOrEqual(16);
  });

  it("prioritizes warm tiles in the movement direction", () => {
    const manager = new CanvasViewportResidencyManager();
    manager.update({
      paneId: "primary", signature: "same", minTileX: 0, maxTileX: 1,
      minTileY: 0, maxTileY: 1, mode: "viewport-interaction",
    });
    const moved = manager.update({
      paneId: "primary", signature: "same", minTileX: 1, maxTileX: 2,
      minTileY: 0, maxTileY: 1, mode: "viewport-interaction",
    });
    const warm = moved.filter(({ residency }) => residency === "warm");
    expect(Math.max(...warm.map(({ x }) => x))).toBeGreaterThan(3);
  });
});
