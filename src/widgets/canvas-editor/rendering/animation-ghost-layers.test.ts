import { describe, expect, it } from "vitest";
import { resolveAnimationGhostLayers } from "./animation-ghost-layers";

const frame = (id: string) => ({
  id,
  name: id,
  grid: [["0,0", { char: id, color: "#fff" }]] as [
    string,
    { char: string; color: string },
  ][],
});

describe("resolveAnimationGhostLayers", () => {
  it("resolves backward and forward layers in render order", () => {
    const frames = [frame("a"), frame("b"), frame("c"), frame("d")];
    const layers = resolveAnimationGhostLayers({
      canvasMode: "animation",
      timeline: {
        frames,
        currentFrameId: "c",
        fps: 12,
        loop: true,
        onionSkin: {
          enabled: true,
          backwardLayers: 2,
          forwardLayers: 1,
          opacityFalloff: [0.5, 0.2],
        },
      },
      playbackFrameId: null,
      getFrameGrid: (candidate) => new Map(candidate.grid),
    });

    expect(layers.map(({ grid, alpha }) => [grid.get("0,0")?.char, alpha])).toEqual([
      ["a", 0.2],
      ["b", 0.5],
      ["d", 0.5],
    ]);
  });

  it("returns no layers outside animation mode", () => {
    expect(
      resolveAnimationGhostLayers({
        canvasMode: "freeform",
        timeline: null,
        playbackFrameId: null,
        getFrameGrid: () => new Map(),
      })
    ).toEqual([]);
  });
});
