import { describe, expect, it, vi } from "vitest";
import type { CharScene } from "../vendor/ascii/scene.js";
import type {
  GridLayout,
  LayoutGraph,
  PositionedLayoutNode,
} from "./model.js";
import {
  renderLayeredDiagram,
  type LayeredDiagramPresentation,
} from "./render.js";

const graph: LayoutGraph = {
  direction: "LR",
  spacing: { nodeNode: 2, nodeNodeBetweenLayers: 4 },
  groups: [],
  nodes: [
    { id: "a", label: "A", width: 4, height: 4 },
    { id: "b", label: "B", width: 4, height: 4 },
  ],
  edges: [{ id: "edge", source: "a", target: "b" }],
};

const layout: GridLayout = {
  width: 14,
  height: 4,
  groups: [],
  nodes: [
    { ...graph.nodes[0]!, x: 0, y: 0 },
    { ...graph.nodes[1]!, x: 10, y: 0 },
  ],
  edges: [{
    ...graph.edges[0]!,
    points: [
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 9, y: 1 },
      { x: 10, y: 1 },
    ],
    sourceEndpoint: {
      side: "right",
      anchor: { x: 3, y: 1 },
      marker: { x: 4, y: 1 },
      outward: { x: 1, y: 0 },
    },
    targetEndpoint: {
      side: "left",
      anchor: { x: 10, y: 1 },
      marker: { x: 9, y: 1 },
      outward: { x: -1, y: 0 },
    },
  }],
};

const drawCompartmentNode = (scene: CharScene, node: PositionedLayoutNode) => {
  scene.add({
    kind: "box",
    owner: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  });
  scene.add({
    kind: "label",
    owner: `${node.id}:label`,
    at: { x: node.x + 1, y: node.y + 1 },
    text: node.label,
  });
  scene.write(node.x, node.y + 2, "├", "border", { owner: node.id });
  scene.write(node.x + 1, node.y + 2, "─", "border", { owner: node.id });
  scene.write(node.x + 2, node.y + 2, "─", "border", { owner: node.id });
  scene.write(node.x + 3, node.y + 2, "┤", "border", { owner: node.id });
};

describe("layered diagram renderer", () => {
  it("renders custom node fragments and multi-cell endpoint decorations", async () => {
    const presentation: LayeredDiagramPresentation = {
      drawGroup() {},
      drawNode: drawCompartmentNode,
      edge() {
        return {
          stroke: { style: "solid", role: "border", rounded: true },
          targetEndpoint: {
            trimAnchor: true,
            paint(scene, context) {
              scene.add({
                kind: "marker",
                owner: "edge:marker",
                at: context.endpoint.marker,
                char: ">",
              });
              scene.add({
                kind: "marker",
                owner: "edge:marker-prefix",
                at: {
                  x: context.endpoint.marker.x + context.endpoint.outward.x,
                  y: context.endpoint.marker.y + context.endpoint.outward.y,
                },
                char: "o",
              });
            },
          },
        };
      },
    };
    const engine = { layout: vi.fn(async () => layout) };

    const output = await renderLayeredDiagram(graph, presentation, {
      useAscii: false,
      engine,
    });

    expect(engine.layout).toHaveBeenCalledWith(graph);
    expect(output).toMatch(/│A ├─+o>│B │/u);
    expect(output.match(/├──┤/gu)).toHaveLength(2);
  });

  it("rejects an invalid injected layout before presentation", async () => {
    const drawNode = vi.fn();
    const presentation: LayeredDiagramPresentation = {
      drawGroup() {},
      drawNode,
      edge: () => ({ stroke: { style: "solid" } }),
    };
    const invalid = {
      ...layout,
      edges: [{
        ...layout.edges[0]!,
        points: [{ x: 3, y: 1 }, { x: 9, y: 2 }, { x: 10, y: 1 }],
      }],
    };

    await expect(renderLayeredDiagram(graph, presentation, {
      useAscii: false,
      engine: { layout: async () => invalid },
    })).rejects.toThrow("Edge edge terminal segment is not perpendicular to node a");
    expect(drawNode).not.toHaveBeenCalled();
  });
});
