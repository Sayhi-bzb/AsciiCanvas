import { describe, expect, it } from "vitest";
import { canvasToString } from "../canvas.js";
import type { NodeShape } from "../../types.js";
import { createFlowCardPresentation } from "./flow-card.js";

const render = (shape: NodeShape, label = "Node", useAscii = false) => {
  const presentation = createFlowCardPresentation(shape, label, {
    useAscii,
    padding: 1,
  });
  return {
    ...presentation,
    text: canvasToString(presentation.canvas),
  };
};

describe("Flow card presentation", () => {
  it.each([
    ["rectangle", undefined],
    ["rounded", undefined],
    ["stadium", "●"],
    ["diamond", "◇"],
    ["circle", "○"],
    ["doublecircle", "◎"],
    ["subroutine", "▣"],
    ["cylinder", "▤"],
    ["hexagon", "⬡"],
    ["asymmetric", "▷"],
    ["trapezoid", "╱"],
    ["trapezoid-alt", "╲"],
  ] as const)("renders %s as a rounded card with marker %s", (shape, marker) => {
    const result = render(shape);

    expect(result.text).toMatch(/^╭─+╮\n/u);
    expect(result.text).toMatch(/\n╰─+╯$/u);
    if (marker) {
      expect(result.text).toContain(`│ ${marker} Node │`);
      expect(result.marker).toBeDefined();
      expect(result.canvas[result.marker!.x]![result.marker!.y]).toBe(marker);
    } else {
      expect(result.text).toContain("│ Node │");
      expect(result.marker).toBeUndefined();
    }
  });

  it.each([
    ["stadium", "*"],
    ["diamond", "?"],
    ["circle", "o"],
    ["doublecircle", "@"],
    ["subroutine", "#"],
    ["cylinder", "D"],
    ["hexagon", "H"],
    ["asymmetric", ">"],
    ["trapezoid", "/"],
    ["trapezoid-alt", "\\"],
  ] as const)("uses a stable ASCII marker for %s", (shape, marker) => {
    const result = render(shape, "Node", true);

    expect(result.text).toMatch(/^\+-+\+\n/u);
    expect(result.text).toContain(`| ${marker} Node |`);
    expect(result.text).toMatch(/\n\+-+\+$/u);
  });

  it("indents continuation lines beneath a shape marker", () => {
    const result = render("diamond", "第一行\n第二行");
    const lines = result.text.split("\n");

    expect(lines.find((line) => line.includes("第一行"))).toContain("◇ 第一行");
    expect(lines.find((line) => line.includes("第二行"))).toContain("  第二行");
    expect(result.dimensions.width).toBe(result.canvas.length);
    expect(result.dimensions.height).toBe(result.canvas[0]!.length);
  });
});
