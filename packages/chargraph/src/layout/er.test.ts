import { describe, expect, it } from "vitest";
import { createLayeredErDiagram, getErEndpointGlyphs } from "./er.js";
import { getDefaultGraphLayoutEngine } from "./elk.js";
import { validateGridLayout } from "./validate.js";

const pointKey = ({ x, y }: { x: number; y: number }) => `${x},${y}`;

const routeCells = (points: Array<{ x: number; y: number }>) => {
  const cells = new Set<string>();
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    const dx = Math.sign(to.x - from.x);
    const dy = Math.sign(to.y - from.y);
    let current = { ...from };
    cells.add(pointKey(current));
    while (current.x !== to.x || current.y !== to.y) {
      current = { x: current.x + dx, y: current.y + dy };
      cells.add(pointKey(current));
    }
  }
  return cells;
};

describe("ER ELK adapter", () => {
  it("rotates Unicode cardinality glyphs for every endpoint side", () => {
    expect(getErEndpointGlyphs("one", "right", false)).toEqual(["│"]);
    expect(getErEndpointGlyphs("one", "bottom", false)).toEqual(["─"]);
    expect(getErEndpointGlyphs("zero-one", "left", false)).toEqual(["│", "○"]);
    expect(getErEndpointGlyphs("many", "right", false)).toEqual(["╢"]);
    expect(getErEndpointGlyphs("many", "left", false)).toEqual(["╟"]);
    expect(getErEndpointGlyphs("many", "bottom", false)).toEqual(["╨"]);
    expect(getErEndpointGlyphs("many", "top", false)).toEqual(["╥"]);
    expect(getErEndpointGlyphs("zero-many", "top", false)).toEqual(["╥", "○"]);
  });

  it("uses directional ASCII cardinality glyphs", () => {
    expect(getErEndpointGlyphs("one", "top", true)).toEqual(["-"]);
    expect(getErEndpointGlyphs("zero-one", "right", true)).toEqual(["|", "o"]);
    expect(getErEndpointGlyphs("many", "right", true)).toEqual([">"]);
    expect(getErEndpointGlyphs("many", "left", true)).toEqual(["<"]);
    expect(getErEndpointGlyphs("many", "bottom", true)).toEqual(["v"]);
    expect(getErEndpointGlyphs("many", "top", true)).toEqual(["^"]);
  });

  it("creates a left-to-right graph with distributed entity ports", () => {
    const diagram = createLayeredErDiagram(`erDiagram
  A ||--o{ B : owns
  A {
    string id PK
  }`, {
      useAscii: false,
      paddingX: 5,
      paddingY: 5,
      boxBorderPadding: 1,
      graphDirection: "TD",
    })!;

    expect(diagram.graph.direction).toBe("LR");
    expect(diagram.graph.nodes.every((node) => node.portPlacement === "distributed"))
      .toBe(true);
    expect(diagram.graph.nodes.every((node) => node.portAllocation === "independent"))
      .toBe(true);
    expect(diagram.graph.edges[0]).toMatchObject({
      source: "entity:A",
      target: "entity:B",
      label: { text: "owns", width: 4, height: 1 },
      labelLayout: "route",
      routing: { topology: "independent", selfLoop: "compact" },
    });
  });

  it("keeps parallel relationships independent and compacts self relationships", async () => {
    const diagram = createLayeredErDiagram(`erDiagram
  用户 ||--o{ 订单 : 创建
  用户 |o..|{ 订单 : 关注
  用户 ||--o{ 用户 : 推荐
  用户 {
    string id PK
    string email UK
  }`, {
      useAscii: false,
      paddingX: 5,
      paddingY: 5,
      boxBorderPadding: 1,
      graphDirection: "LR",
    })!;
    const layout = await getDefaultGraphLayoutEngine().layout(diagram.graph);
    const [created, followed, recommended] = layout.edges;
    const followedCells = routeCells(followed!.points);

    expect(validateGridLayout(layout)).toEqual([]);
    expect(created?.targetEndpoint.anchor).not.toEqual(followed?.targetEndpoint.anchor);
    expect([...routeCells(created!.points)].filter((cell) =>
      followedCells.has(cell)
    )).toHaveLength(0);
    expect(recommended?.points).toHaveLength(4);
    expect(recommended?.labelPosition?.y).toBe(
      Math.min(...recommended!.points.map((point) => point.y)),
    );
    expect(
      Math.max(...recommended!.points.map((point) => point.y)) -
      Math.min(...recommended!.points.map((point) => point.y)),
    ).toBeLessThanOrEqual(3);
    expect(layout.nodes.find((node) => node.id === "entity:订单")?.height)
      .toBeGreaterThanOrEqual(4);
  });
});
