import { describe, expect, it } from "vitest";
import { generateAnimationFrames } from "@/domains/animation-generators/utils/generators";

describe("animation generators", () => {
  const input = {
    fallbackColor: "#ffffff",
    grid: [
      ["0,0", { char: "A", color: "#111111" }],
      ["1,0", { char: "B", color: "#222222" }],
      ["2,0", { char: "C", color: "#333333" }],
    ] as [string, { char: string; color: string }][],
  };

  it("generates spinner frames at a fixed grid position", () => {
    const { frames } = generateAnimationFrames(input, {
      kind: "spinner",
      sequence: "|-",
      x: 4,
      y: 2,
      color: "#ff0000",
      loops: 2,
    });

    expect(frames).toHaveLength(4);
    expect(frames.map((frame) => frame.grid.at(-1))).toEqual([
      ["4,2", { char: "|", color: "#ff0000" }],
      ["4,2", { char: "-", color: "#ff0000" }],
      ["4,2", { char: "|", color: "#ff0000" }],
      ["4,2", { char: "-", color: "#ff0000" }],
    ]);
  });

  it("generates sweep highlight frames without changing characters", () => {
    const { frames } = generateAnimationFrames(input, {
      kind: "sweep-highlight",
      direction: "left-to-right",
      highlightColor: "#ffffff",
      width: 1,
      frameCount: 3,
      preserveBaseColor: true,
    });

    expect(frames).toHaveLength(3);
    expect(frames[1].grid.map(([, cell]) => cell.char)).toEqual(["A", "B", "C"]);
    expect(frames[1].grid[1][1].color).toBe("#ffffff");
  });

  it("generates reveal frames by increasing visible cells", () => {
    const { frames } = generateAnimationFrames(input, {
      kind: "reveal",
      direction: "left-to-right",
      frameCount: 3,
    });

    expect(frames.map((frame) => frame.grid.length)).toEqual([1, 2, 3]);
  });

  it("generates color flow frames while preserving characters", () => {
    const { frames } = generateAnimationFrames(input, {
      kind: "color-flow",
      fromColor: "#000000",
      toColor: "#ffffff",
      direction: "left-to-right",
      frameCount: 2,
    });

    expect(frames).toHaveLength(2);
    expect(frames[0].grid.map(([, cell]) => cell.char)).toEqual(["A", "B", "C"]);
    expect(frames[0].grid[0][1].color).toBe("#000000");
    expect(frames[1].grid[0][1].color).not.toBe(frames[0].grid[0][1].color);
  });
});
