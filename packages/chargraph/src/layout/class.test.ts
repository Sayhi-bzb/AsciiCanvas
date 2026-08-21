import { describe, expect, it } from "vitest";
import { getDefaultGraphLayoutEngine } from "./elk.js";
import { createLayeredClassDiagram } from "./class.js";

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
});
