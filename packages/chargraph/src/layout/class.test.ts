import { describe, expect, it } from "vitest";
import { getDefaultGraphLayoutEngine } from "./elk.js";
import { createLayeredClassDiagram } from "./class.js";
import { validateGridLayout } from "./validate.js";

const config = {
  useAscii: false,
  paddingX: 5,
  paddingY: 5,
  boxBorderPadding: 1,
  graphDirection: "TD" as const,
};

describe("Class ELK adapter", () => {
  it("models namespaces as compound groups containing their classes", async () => {
    const diagram = createLayeredClassDiagram(`classDiagram
  namespace Domain {
    class Document
    class Page
  }
  Document --> Page`, config);
    expect(diagram).toBeDefined();
    const layout = await getDefaultGraphLayoutEngine().layout(diagram!.graph);
    const group = layout.groups.find((candidate) => candidate.id === "namespace:Domain")!;
    const members = layout.nodes.filter((node) => node.parentId === group.id);

    expect(members).toHaveLength(2);
    for (const member of members) {
      expect(member.x).toBeGreaterThan(group.x);
      expect(member.y).toBeGreaterThan(group.y);
      expect(member.x + member.width).toBeLessThan(group.x + group.width);
      expect(member.y + member.height).toBeLessThan(group.y + group.height);
    }
  });

  it("orients hierarchical layout from the marked parent to the child", () => {
    const diagram = createLayeredClassDiagram(`classDiagram
  Child ..|> Parent
  Root <|-- Leaf`, config)!;

    expect(diagram.graph.edges).toEqual([
      expect.objectContaining({
        source: "class:Parent",
        target: "class:Child",
      }),
      expect.objectContaining({
        source: "class:Root",
        target: "class:Leaf",
      }),
    ]);
    expect(diagram.graph.nodes.every((node) => node.portPlacement === "distributed"))
      .toBe(true);
  });

  it("uses balanced spacing and route-placed relationship labels", () => {
    const diagram = createLayeredClassDiagram(`classDiagram
  Document ..> Renderer : uses`, {
      ...config,
      paddingX: 3,
      paddingY: 3,
    })!;

    expect(diagram.graph.spacing).toEqual({
      nodeNode: 3,
      nodeNodeBetweenLayers: 3,
    });
    expect(diagram.graph.edges[0]).toEqual(expect.objectContaining({
      labelLayout: "route",
      label: expect.objectContaining({ text: "uses" }),
    }));
  });

  it("keeps endpoint cardinalities inside their namespace geometry", async () => {
    const diagram = createLayeredClassDiagram(`classDiagram
  namespace 内容域 {
    class 文档
    class 页面
  }
  文档 "1" --> "0..*" 页面 : 包含`, config)!;

    expect(diagram.graph.edges[0]).toEqual(expect.objectContaining({
      sourceLabel: { text: "1", width: 1, height: 1 },
      targetLabel: { text: "0..*", width: 4, height: 1 },
    }));

    const layout = await getDefaultGraphLayoutEngine().layout(diagram.graph);
    const group = layout.groups.find((candidate) => candidate.id === "namespace:内容域")!;
    const edge = layout.edges[0]!;
    for (const [label, position] of [
      [edge.sourceLabel, edge.sourceLabelPosition],
      [edge.targetLabel, edge.targetLabelPosition],
    ] as const) {
      expect(position).toBeDefined();
      expect(position!.x).toBeGreaterThan(group.x);
      expect(position!.y).toBeGreaterThan(group.y);
      expect(position!.x + label!.width).toBeLessThan(group.x + group.width);
      expect(position!.y + label!.height).toBeLessThan(group.y + group.height);
    }
    expect(validateGridLayout(layout)).toEqual([]);

    edge.targetLabelPosition = { x: group.x + group.width - 1, y: group.y + 1 };
    expect(validateGridLayout(layout)).toContain(
      "Edge class-edge:0 target label escapes group namespace:内容域",
    );
  });

  it("reserves layer space for multiline cardinalities", async () => {
    const diagram = createLayeredClassDiagram(`classDiagram
  namespace 内容域 {
    class 文档
    class 页面
  }
  文档 "1<br/>唯一" --> "0..*<br/>页面" 页面 : 包含`, {
      ...config,
      paddingY: 3,
    })!;

    expect(diagram.graph.spacing.nodeNodeBetweenLayers).toBe(5);
    const layout = await getDefaultGraphLayoutEngine().layout(diagram.graph);
    expect(validateGridLayout(layout)).toEqual([]);
  });
});
