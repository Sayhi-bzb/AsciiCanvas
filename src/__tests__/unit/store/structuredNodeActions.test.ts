import { describe, expect, it } from "vitest";
import type { StructuredNode } from "@/shared/types";
import {
  duplicateStructuredNodes,
  reorderStructuredNodes,
} from "@/domains/canvas/state/helpers/structuredNodeActions";

const scene = (): StructuredNode[] => [
  {
    id: "a",
    type: "box",
    order: 1,
    start: { x: 0, y: 0 },
    end: { x: 2, y: 2 },
    style: { color: "#fff" },
  },
  {
    id: "b",
    type: "line",
    order: 2,
    start: { x: 4, y: 0 },
    end: { x: 8, y: 0 },
    axis: "horizontal",
    style: { color: "#fff" },
  },
  {
    id: "c",
    type: "text",
    order: 3,
    position: { x: 10, y: 0 },
    text: "label",
    style: { color: "#fff" },
  },
];

const idsByOrder = (nodes: StructuredNode[]) =>
  [...nodes].sort((a, b) => a.order - b.order).map((node) => node.id);

describe("structuredNodeActions", () => {
  it("moves selected nodes by one layer while preserving relative order", () => {
    expect(idsByOrder(reorderStructuredNodes(scene(), ["a"], "forward"))).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(idsByOrder(reorderStructuredNodes(scene(), ["b", "c"], "backward"))).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("moves selected nodes to front or back", () => {
    expect(idsByOrder(reorderStructuredNodes(scene(), ["a", "b"], "front"))).toEqual([
      "c",
      "a",
      "b",
    ]);
    expect(idsByOrder(reorderStructuredNodes(scene(), ["b", "c"], "back"))).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("duplicates selected nodes with new ids and a default offset", () => {
    const { scene: nextScene, duplicatedIds } = duplicateStructuredNodes(scene(), ["a", "c"]);
    expect(duplicatedIds).toHaveLength(2);
    expect(duplicatedIds).not.toContain("a");
    expect(duplicatedIds).not.toContain("c");

    const duplicates = nextScene.filter((node) => duplicatedIds.includes(node.id));
    expect(duplicates[0]).toMatchObject({
      type: "box",
      start: { x: 1, y: 1 },
      end: { x: 3, y: 3 },
    });
    expect(duplicates[1]).toMatchObject({
      type: "text",
      position: { x: 11, y: 1 },
      text: "label",
    });
  });
});
