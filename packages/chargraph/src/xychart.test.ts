import { getTextCellWidth } from "@chardesk/protocol";
import { describe, expect, it } from "vitest";
import { renderMermaid, type MermaidRenderOptions } from "./mermaid.js";

const renderXY = async (source: string, options?: MermaidRenderOptions) => {
  const result = await renderMermaid(source, options);
  expect(result.diagnostics).toEqual([]);
  return result.fragments[0]!.text;
};

const dimensions = (text: string) => {
  const lines = text.split("\n");
  return {
    width: Math.max(...lines.map(getTextCellWidth)),
    height: lines.length,
  };
};

const consecutiveDistances = (positions: number[]) =>
  positions.slice(1).map((position, index) => position - positions[index]!);

const numericTickRows = (text: string) =>
  text.split("\n").flatMap((line, row) =>
    /^\s*-?\d+(?:\.\d+)?[┤┼+]/u.test(line) ? [row] : []
  );

describe("compact XY chart layout", () => {
  it("keeps a typical CJK vertical chart within the balanced footprint", async () => {
    const output = await renderXY(`xychart-beta
  title "月度趋势"
  x-axis [一月, 二月, 三月]
  y-axis "数量" 0 --> 10
  bar [3, 7, 5]
  line [2, 5, 8]`);

    expect(dimensions(output).width).toBeLessThanOrEqual(40);
    expect(dimensions(output).height).toBe(16);
    expect(consecutiveDistances(numericTickRows(output))).toEqual([
      2,
      2,
      2,
      2,
      2,
    ]);
    expect(output).toContain("月度趋势");
    expect(output).toContain("一月");
    expect(output).toContain("三月");
    expect(output).toMatch(/[█╭╮╰╯]/u);
  });

  it("keeps a typical CJK horizontal chart within the balanced footprint", async () => {
    const output = await renderXY(`xychart-beta horizontal
  title "季度增长"
  x-axis [第一季, 第二季, 第三季, 第四季]
  y-axis "增长率" -5 --> 15
  bar [3, 8, 6, 12]
  line [1, 5, 9, 14]`);

    expect(dimensions(output).width).toBeLessThanOrEqual(48);
    expect(dimensions(output).height).toBe(18);
    expect(output).toContain("第一季");
    expect(output).toContain("第四季");
    expect(output).toContain("-5");
    expect(output).toContain("15");

    const axisLine = output.split("\n").find((line) => line.includes("┼┬"));
    expect(axisLine).toBeDefined();
    const tickColumns = Array.from(axisLine!).flatMap((character, column) =>
      character === "┬" ? [column] : []
    );
    expect(new Set(consecutiveDistances(tickColumns)).size).toBe(1);
  });

  it("expands for long categories and multiple bar series", async () => {
    const output = await renderXY(`xychart-beta
  title "容量比较"
  x-axis [超长分类标签一, 超长分类标签二]
  y-axis 0 --> 100
  bar [20, 80]
  bar [40, 60]
  bar [70, 30]`);

    expect(output).toContain("超长分类标签一");
    expect(output).toContain("超长分类标签二");
    expect(output).toContain("Bar 3");
    expect(dimensions(output).width).toBeGreaterThan(40);
  });

  it("preserves compact sizing and chart semantics in ASCII mode", async () => {
    const output = await renderXY(`xychart-beta
  x-axis [A, B, C]
  y-axis -1 --> 1
  bar [-1, 0, 1]
  line [1, 0, -1]`, { characterSet: "ascii" });

    expect(dimensions(output).width).toBeLessThanOrEqual(44);
    expect(consecutiveDistances(numericTickRows(output))).toEqual([
      2,
      2,
      2,
      2,
    ]);
    expect(output).toContain("#");
    expect(output).toMatch(/[+|-]/u);
  });
});
