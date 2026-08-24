import { describe, expect, it } from "vitest";
import type { ElkNode } from "elkjs/lib/elk-api.js";
import { fromElkGraph, toElkGraph } from "./elk-adapter.js";
import type { LayoutGraph } from "./model.js";
import { validateGridLayout } from "./validate.js";

describe("ELK cell endpoint projection", () => {
  it("reserves compound padding for endpoint-owned labels", () => {
    const graph: LayoutGraph = {
      direction: "TD",
      spacing: { nodeNode: 2, nodeNodeBetweenLayers: 3 },
      groups: [{ id: "group", label: "Domain" }],
      nodes: [
        { id: "a", label: "A", width: 5, height: 3, parentId: "group" },
        { id: "b", label: "B", width: 5, height: 3, parentId: "group" },
      ],
      edges: [{
        id: "edge",
        source: "a",
        target: "b",
        targetLabel: { text: "0..*", width: 4, height: 1 },
      }],
    };

    const group = toElkGraph(graph).children?.[0];
    expect(group?.layoutOptions?.["elk.padding"])
      .toBe("[top=2,left=2,bottom=2,right=5]");
  });

  it("maps rooted cycle breaking without changing the default", () => {
    const graph: LayoutGraph = {
      direction: "TD",
      cycleBreaking: "depth-first",
      spacing: { nodeNode: 2, nodeNodeBetweenLayers: 2 },
      groups: [],
      nodes: [
        { id: "a", label: "A", width: 5, height: 3 },
        { id: "b", label: "B", width: 5, height: 3 },
      ],
      edges: [{ id: "edge", source: "a", target: "b" }],
    };

    expect(toElkGraph(graph).layoutOptions?.["elk.layered.cycleBreaking.strategy"])
      .toBe("DEPTH_FIRST");
    expect(toElkGraph({ ...graph, cycleBreaking: "automatic" })
      .layoutOptions?.["elk.layered.cycleBreaking.strategy"]).toBeUndefined();
  });

  it("maps balanced node alignment without changing automatic graphs", () => {
    const graph: LayoutGraph = {
      direction: "TD",
      nodeAlignment: "balanced",
      spacing: { nodeNode: 2, nodeNodeBetweenLayers: 3 },
      groups: [],
      nodes: [
        { id: "a", label: "A", width: 5, height: 3 },
        { id: "b", label: "B", width: 5, height: 3 },
      ],
      edges: [{ id: "edge", source: "a", target: "b" }],
    };

    expect(toElkGraph(graph).layoutOptions?.[
      "elk.layered.nodePlacement.bk.fixedAlignment"
    ]).toBe("BALANCED");
    expect(toElkGraph({ ...graph, nodeAlignment: "automatic" }).layoutOptions?.[
      "elk.layered.nodePlacement.bk.fixedAlignment"
    ]).toBeUndefined();
  });

  it("gives every independent edge end a dedicated fixed-order ELK port", () => {
    const graph: LayoutGraph = {
      direction: "LR",
      spacing: { nodeNode: 2, nodeNodeBetweenLayers: 6 },
      groups: [],
      nodes: [
        {
          id: "a",
          label: "A",
          width: 8,
          height: 4,
          portAllocation: "independent",
        },
        {
          id: "b",
          label: "B",
          width: 8,
          height: 4,
          portAllocation: "independent",
        },
      ],
      edges: [
        { id: "first", source: "a", target: "b" },
        { id: "second", source: "a", target: "b" },
      ],
    };

    const elk = toElkGraph(graph);
    const [source, target] = elk.children!;

    expect(source?.ports).toHaveLength(2);
    expect(target?.ports).toHaveLength(2);
    expect(source?.layoutOptions?.["elk.portConstraints"]).toBe("FIXED_ORDER");
    expect(new Set(elk.edges?.flatMap((edge) => edge.sources ?? [])).size).toBe(2);
    expect(new Set(elk.edges?.flatMap((edge) => edge.targets ?? [])).size).toBe(2);
  });

  it.each([
    ["LR", "EAST", ["0", "1"], "WEST", ["1", "0"]],
    ["RL", "WEST", ["1", "0"], "EAST", ["0", "1"]],
    ["TD", "SOUTH", ["1", "0"], "NORTH", ["0", "1"]],
    ["BT", "NORTH", ["0", "1"], "SOUTH", ["1", "0"]],
  ] as const)(
    "normalizes %s independent ports into visual order",
    (direction, sourceSide, sourceIndexes, targetSide, targetIndexes) => {
      const graph: LayoutGraph = {
        direction,
        spacing: { nodeNode: 2, nodeNodeBetweenLayers: 6 },
        groups: [],
        nodes: [
          {
            id: "a",
            label: "A",
            width: 8,
            height: 4,
            portAllocation: "independent",
          },
          {
            id: "b",
            label: "B",
            width: 8,
            height: 4,
            portAllocation: "independent",
          },
        ],
        edges: [
          { id: "first", source: "a", target: "b" },
          { id: "second", source: "a", target: "b" },
        ],
      };

      const [source, target] = toElkGraph(graph).children!;

      expect(source?.ports?.map((port) => port.layoutOptions?.["elk.port.side"]))
        .toEqual([sourceSide, sourceSide]);
      expect(source?.ports?.map((port) => port.layoutOptions?.["elk.port.index"]))
        .toEqual(sourceIndexes);
      expect(target?.ports?.map((port) => port.layoutOptions?.["elk.port.side"]))
        .toEqual([targetSide, targetSide]);
      expect(target?.ports?.map((port) => port.layoutOptions?.["elk.port.index"]))
        .toEqual(targetIndexes);
    },
  );

  it("omits route-placed labels from ELK without dropping their model data", () => {
    const graph: LayoutGraph = {
      direction: "LR",
      spacing: { nodeNode: 3, nodeNodeBetweenLayers: 3 },
      groups: [],
      nodes: [
        { id: "a", label: "A", width: 5, height: 3 },
        { id: "b", label: "B", width: 5, height: 3 },
      ],
      edges: [{
        id: "edge",
        source: "a",
        target: "b",
        label: { text: "uses", width: 4, height: 1 },
        labelLayout: "route",
      }],
    };

    expect(toElkGraph(graph).edges?.[0]?.labels).toBeUndefined();
    expect(graph.edges[0]?.label?.text).toBe("uses");
  });

  it("uses ELK's geometric boundary before mapping an endpoint to a cell border", () => {
    const graph: LayoutGraph = {
      direction: "LR",
      spacing: { nodeNode: 2, nodeNodeBetweenLayers: 4 },
      groups: [],
      nodes: [
        { id: "a", label: "A", width: 12, height: 5 },
        { id: "b", label: "B", width: 12, height: 5 },
      ],
      edges: [{
        id: "edge",
        source: "a",
        target: "b",
      }],
    };
    const laidOut: ElkNode = {
      id: "layout:root",
      width: 30,
      height: 20,
      children: [
        { id: "a", x: 1, y: 7, width: 12, height: 5 },
        { id: "b", x: 17, y: 7, width: 12, height: 5 },
      ],
      edges: [{
        id: "edge",
        sources: ["a"],
        targets: ["b"],
        sections: [{
          id: "edge:section",
          startPoint: { x: 13, y: 10.5 },
          endPoint: { x: 17, y: 10.5 },
          incomingShape: "a",
          outgoingShape: "b",
        }],
      }],
    };

    const edge = fromElkGraph(graph, laidOut).edges[0]!;

    expect(edge.sourceEndpoint).toEqual({
      side: "right",
      anchor: { x: 12, y: 9 },
      marker: { x: 13, y: 9 },
      outward: { x: 1, y: 0 },
    });
    expect(edge.targetEndpoint.side).toBe("left");
    expect(edge.points.slice(0, 2)).toEqual([
      edge.sourceEndpoint.anchor,
      edge.sourceEndpoint.marker,
    ]);
    expect(edge.points.slice(-2)).toEqual([
      edge.targetEndpoint.marker,
      edge.targetEndpoint.anchor,
    ]);
  });

  it("aligns readable endpoints instead of keeping a one-cell dogleg", () => {
    const graph: LayoutGraph = {
      direction: "TD",
      spacing: { nodeNode: 2, nodeNodeBetweenLayers: 3 },
      groups: [],
      nodes: [
        { id: "a", label: "A", width: 7, height: 3 },
        { id: "b", label: "B", width: 7, height: 3 },
      ],
      edges: [{
        id: "edge",
        source: "a",
        target: "b",
        routing: { quality: "readable", targetClearance: 1 },
      }],
    };
    const laidOut: ElkNode = {
      id: "layout:root",
      width: 20,
      height: 14,
      children: [
        { id: "a", x: 1, y: 1, width: 7, height: 3 },
        { id: "b", x: 2, y: 8, width: 7, height: 3 },
      ],
      edges: [{
        id: "edge",
        sources: ["a"],
        targets: ["b"],
        sections: [{
          id: "edge:section",
          startPoint: { x: 4.5, y: 4 },
          bendPoints: [{ x: 4.5, y: 5 }, { x: 5.5, y: 5 }],
          endPoint: { x: 5.5, y: 8 },
        }],
      }],
    };

    const edge = fromElkGraph(graph, laidOut).edges[0]!;

    expect(edge.sourceEndpoint.anchor.x).toBe(edge.targetEndpoint.anchor.x);
    expect(new Set(edge.points.map((point) => point.x))).toEqual(new Set([5]));
  });

  it("treats tiny vertical endpoints as center-only attachment ranges", () => {
    const graph: LayoutGraph = {
      direction: "TD",
      spacing: { nodeNode: 2, nodeNodeBetweenLayers: 2 },
      groups: [],
      nodes: [
        { id: "start", label: "", width: 1, height: 1 },
        { id: "state", label: "State", width: 12, height: 5 },
        { id: "end", label: "", width: 1, height: 1 },
      ],
      edges: [
        {
          id: "enter",
          source: "start",
          target: "state",
          routing: { quality: "readable", targetClearance: 1 },
        },
        {
          id: "leave",
          source: "state",
          target: "end",
          routing: { quality: "readable", targetClearance: 1 },
        },
      ],
    };
    const laidOut: ElkNode = {
      id: "layout:root",
      width: 20,
      height: 14,
      children: [
        { id: "start", x: 12, y: 1, width: 1, height: 1 },
        { id: "state", x: 6, y: 4, width: 12, height: 5 },
        { id: "end", x: 12, y: 11, width: 1, height: 1 },
      ],
      edges: [
        {
          id: "enter",
          sources: ["start"],
          targets: ["state"],
          sections: [{
            id: "enter:section",
            startPoint: { x: 12.5, y: 2 },
            bendPoints: [{ x: 12.5, y: 3 }, { x: 11.5, y: 3 }],
            endPoint: { x: 11.5, y: 4 },
          }],
        },
        {
          id: "leave",
          sources: ["state"],
          targets: ["end"],
          sections: [{
            id: "leave:section",
            startPoint: { x: 11.5, y: 9 },
            bendPoints: [{ x: 11.5, y: 10 }, { x: 12.5, y: 10 }],
            endPoint: { x: 12.5, y: 11 },
          }],
        },
      ],
    };

    const edges = fromElkGraph(graph, laidOut).edges;

    expect(edges).toHaveLength(2);
    for (const edge of edges) {
      expect(edge.sourceEndpoint.anchor.x).toBe(12);
      expect(edge.targetEndpoint.anchor.x).toBe(12);
      expect(new Set(edge.points.map((point) => point.x))).toEqual(new Set([12]));
    }
  });

  it("treats a tiny horizontal endpoint as a center-only attachment range", () => {
    const graph: LayoutGraph = {
      direction: "LR",
      spacing: { nodeNode: 2, nodeNodeBetweenLayers: 2 },
      groups: [],
      nodes: [
        { id: "start", label: "", width: 1, height: 1 },
        { id: "state", label: "State", width: 7, height: 9 },
      ],
      edges: [{
        id: "edge",
        source: "start",
        target: "state",
        routing: { quality: "readable", targetClearance: 1 },
      }],
    };
    const laidOut: ElkNode = {
      id: "layout:root",
      width: 14,
      height: 16,
      children: [
        { id: "start", x: 1, y: 8, width: 1, height: 1 },
        { id: "state", x: 4, y: 4, width: 7, height: 9 },
      ],
      edges: [{
        id: "edge",
        sources: ["start"],
        targets: ["state"],
        sections: [{
          id: "edge:section",
          startPoint: { x: 2, y: 8.5 },
          bendPoints: [{ x: 3, y: 8.5 }, { x: 3, y: 7.5 }],
          endPoint: { x: 4, y: 7.5 },
        }],
      }],
    };

    const edge = fromElkGraph(graph, laidOut).edges[0]!;

    expect(edge.sourceEndpoint.anchor.y).toBe(8);
    expect(edge.targetEndpoint.anchor.y).toBe(8);
    expect(new Set(edge.points.map((point) => point.y))).toEqual(new Set([8]));
  });

  it("prefers a compact readable route over the first strict detour", () => {
    const graph: LayoutGraph = {
      direction: "LR",
      spacing: { nodeNode: 2, nodeNodeBetweenLayers: 3 },
      groups: [],
      nodes: [
        { id: "a", label: "A", width: 5, height: 3 },
        { id: "b", label: "B", width: 5, height: 3 },
      ],
      edges: [{
        id: "edge",
        source: "a",
        target: "b",
        routing: { quality: "readable", targetClearance: 1 },
      }],
    };
    const laidOut: ElkNode = {
      id: "layout:root",
      width: 20,
      height: 15,
      children: [
        { id: "a", x: 5, y: 5, width: 5, height: 3 },
        { id: "b", x: 12, y: 9, width: 5, height: 3 },
      ],
      edges: [{
        id: "edge",
        sources: ["a"],
        targets: ["b"],
        sections: [{
          id: "edge:section",
          startPoint: { x: 7, y: 5 },
          bendPoints: [
            { x: 7, y: 4 },
            { x: 8, y: 4 },
            { x: 8, y: 10 },
          ],
          endPoint: { x: 12, y: 10 },
        }],
      }],
    };

    const edge = fromElkGraph(graph, laidOut).edges[0]!;

    expect(edge.points).toEqual([
      { x: 7, y: 5 },
      { x: 7, y: 4 },
      { x: 10, y: 4 },
      { x: 10, y: 10 },
      { x: 12, y: 10 },
    ]);
    expect(validateGridLayout({
      width: 20,
      height: 15,
      groups: [],
      nodes: [
        { ...graph.nodes[0]!, x: 5, y: 5 },
        { ...graph.nodes[1]!, x: 12, y: 9 },
      ],
      edges: [edge],
    })).toEqual([]);
  });

  it("preserves distinct ELK attachment positions for distributed ports", () => {
    const graph: LayoutGraph = {
      direction: "LR",
      spacing: { nodeNode: 2, nodeNodeBetweenLayers: 4 },
      groups: [],
      nodes: [
        { id: "a", label: "A", width: 12, height: 8, portPlacement: "distributed" },
        { id: "b", label: "B", width: 12, height: 5 },
        { id: "c", label: "C", width: 12, height: 5 },
      ],
      edges: [
        { id: "ab", source: "a", target: "b" },
        { id: "ac", source: "a", target: "c" },
      ],
    };
    const laidOut: ElkNode = {
      id: "layout:root",
      width: 50,
      height: 30,
      children: [
        { id: "a", x: 1, y: 5, width: 12, height: 8 },
        { id: "b", x: 25, y: 1, width: 12, height: 5 },
        { id: "c", x: 25, y: 16, width: 12, height: 5 },
      ],
      edges: [
        {
          id: "ab", sources: ["a"], targets: ["b"], sections: [{
            id: "ab:section",
            startPoint: { x: 13, y: 7 }, endPoint: { x: 25, y: 3 },
            bendPoints: [{ x: 19, y: 7 }, { x: 19, y: 3 }],
          }],
        },
        {
          id: "ac", sources: ["a"], targets: ["c"], sections: [{
            id: "ac:section",
            startPoint: { x: 13, y: 11 }, endPoint: { x: 25, y: 18 },
            bendPoints: [{ x: 19, y: 11 }, { x: 19, y: 18 }],
          }],
        },
      ],
    };

    const [first, second] = fromElkGraph(graph, laidOut).edges;
    expect(first?.sourceEndpoint.anchor).toEqual({ x: 12, y: 7 });
    expect(second?.sourceEndpoint.anchor).toEqual({ x: 12, y: 11 });
  });

  it("keeps an inline edge label strictly inside bend and marker cells", () => {
    const graph: LayoutGraph = {
      direction: "LR",
      spacing: { nodeNode: 2, nodeNodeBetweenLayers: 3 },
      groups: [],
      nodes: [
        { id: "a", label: "A", width: 5, height: 3 },
        { id: "b", label: "B", width: 5, height: 3 },
      ],
      edges: [{
        id: "edge",
        source: "a",
        target: "b",
        label: { text: "FAIL", width: 4, height: 1 },
      }],
    };
    const laidOut: ElkNode = {
      id: "layout:root",
      width: 20,
      height: 12,
      children: [
        { id: "a", x: 1, y: 5, width: 5, height: 3 },
        { id: "b", x: 13, y: 4, width: 5, height: 3 },
      ],
      edges: [{
        id: "edge",
        sources: ["a"],
        targets: ["b"],
        sections: [{
          id: "edge:section",
          startPoint: { x: 6, y: 6 },
          bendPoints: [{ x: 7, y: 6 }, { x: 7, y: 5 }],
          endPoint: { x: 13, y: 5 },
        }],
      }],
    };

    const layout = fromElkGraph(graph, laidOut);
    const edge = layout.edges[0]!;

    expect(edge.labelPosition).toEqual({ x: 8, y: 5 });
    expect(edge.points).toContainEqual({ x: 7, y: 5 });
    expect(edge.points).toContainEqual({ x: 12, y: 5 });
    expect(validateGridLayout(layout)).toEqual([]);
  });

  it("moves a label beside the route when no segment has safe inline space", () => {
    const graph: LayoutGraph = {
      direction: "LR",
      spacing: { nodeNode: 2, nodeNodeBetweenLayers: 3 },
      groups: [],
      nodes: [
        { id: "a", label: "A", width: 5, height: 3 },
        { id: "b", label: "B", width: 5, height: 3 },
      ],
      edges: [{
        id: "edge",
        source: "a",
        target: "b",
        label: { text: "TOO-LONG", width: 8, height: 1 },
      }],
    };
    const laidOut: ElkNode = {
      id: "layout:root",
      width: 20,
      height: 12,
      children: [
        { id: "a", x: 1, y: 5, width: 5, height: 3 },
        { id: "b", x: 13, y: 4, width: 5, height: 3 },
      ],
      edges: [{
        id: "edge",
        sources: ["a"],
        targets: ["b"],
        sections: [{
          id: "edge:section",
          startPoint: { x: 6, y: 6 },
          bendPoints: [{ x: 7, y: 6 }, { x: 7, y: 5 }],
          endPoint: { x: 13, y: 5 },
        }],
      }],
    };

    const layout = fromElkGraph(graph, laidOut);
    const edge = layout.edges[0]!;

    expect(edge.labelPosition?.y).not.toBe(5);
    expect(validateGridLayout(layout)).toEqual([]);

    edge.labelPosition = { x: 7, y: 5 };
    expect(validateGridLayout(layout)).toContain(
      "Edge edge label overlaps a protected route cell",
    );
  });
});
