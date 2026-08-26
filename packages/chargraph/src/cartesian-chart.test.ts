import { describe, expect, it } from "vitest";
import { getCharGraphText } from "./fragments.js";
import { adaptMermaidXYChart, renderCartesianChart } from "./cartesian-chart.js";
import { parseXYChart } from "./vendor/xychart/parser.js";
import { renderMarkdown } from "./markdown-default.js";
import { parseVegaLiteChart } from "./vega-lite-chart.js";

const pointColumns = (text: string) => {
  const line = text.split("\n").find((value) => value.includes("●"));
  return line ? Array.from(line).flatMap((value, index) => value === "●" ? [index] : []) : [];
};

describe("Cartesian charts", () => {
  it("projects irregular numeric x values instead of category indexes", () => {
    const text = getCharGraphText(renderCartesianChart({
      x: { scale: "linear" },
      y: { scale: "linear", domain: [0, 2] },
      series: [{
        mark: "point",
        points: [0, 0.5, 1, 2, 4, 8].map((x) => ({ x, y: 1 })),
      }],
    }));
    const columns = pointColumns(text);
    const gaps = columns.slice(1).map((column, index) => column - columns[index]!);

    expect(columns).toHaveLength(6);
    expect(new Set(gaps).size).toBeGreaterThan(1);
    expect(gaps.at(-1)).toBeGreaterThan(gaps[0]!);
  });

  it("adapts a Vega-Lite unit spec into named series", () => {
    const spec = parseVegaLiteChart(JSON.stringify({
      data: { values: [
        { x: 0, y: 1, group: "control" },
        { x: 2, y: 3, group: "treated" },
      ] },
      mark: "line",
      encoding: {
        x: { field: "x", type: "quantitative" },
        y: { field: "y", type: "quantitative" },
        color: { field: "group", type: "nominal" },
      },
    }));

    expect(spec.x.scale).toBe("linear");
    expect(spec.series.map((series) => series.name)).toEqual(["control", "treated"]);
  });

  it("adapts Mermaid numeric ranges into explicit point coordinates", () => {
    const spec = adaptMermaidXYChart(parseXYChart([
      "xychart-beta",
      "x-axis 0 --> 8",
      "line [0, 2, 4]",
    ]));

    expect(spec.x).toEqual({ scale: "linear", domain: [0, 8] });
    expect(spec.series[0]?.points.map((point) => point.x)).toEqual([0, 4, 8]);
  });

  it("renders vega-lite fences and preserves unsupported specs", async () => {
    const valid = await renderMarkdown(`\`\`\`vega-lite\n${JSON.stringify({
      data: { values: [{ x: 0, y: 1 }, { x: 2, y: 2 }] },
      mark: "point",
      encoding: {
        x: { field: "x", type: "quantitative" },
        y: { field: "y", type: "quantitative" },
      },
    })}\n\`\`\``);
    const unsupported = await renderMarkdown(`\`\`\`vega-lite\n${JSON.stringify({
      data: { values: [{ x: 0, y: 1 }] },
      transform: [{ filter: "datum.x > 0" }],
      mark: "point",
      encoding: {
        x: { field: "x", type: "quantitative" },
        y: { field: "y", type: "quantitative" },
      },
    })}\n\`\`\``);

    expect(valid.diagnostics).toEqual([]);
    expect(getCharGraphText(valid)).toContain("●");
    expect(unsupported.diagnostics[0]?.code).toBe("markdown-chart-render-failed");
    expect(getCharGraphText(unsupported)).toContain("```vega-lite");
  });
});
