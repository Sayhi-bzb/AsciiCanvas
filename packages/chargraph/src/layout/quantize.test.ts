import { describe, expect, it } from "vitest";
import { quantizeRoute } from "./quantize.js";
import { validateGridLayout } from "./validate.js";
import type { GridLayout } from "./model.js";

describe("cell layout projection", () => {
  it("projects half-cell ELK routes without collapsing orthogonal turns", () => {
    expect(quantizeRoute([
      { x: 3, y: 2.5 },
      { x: 7.5, y: 2.5 },
      { x: 7.5, y: 9 },
    ])).toEqual([
      { x: 3, y: 2 },
      { x: 7, y: 2 },
      { x: 7, y: 9 },
    ]);
  });

  it("reports diagonal routes and node crossings as hard-constraint failures", () => {
    const layout: GridLayout = {
      width: 12,
      height: 8,
      groups: [],
      nodes: [
        { id: "a", label: "A", x: 0, y: 0, width: 3, height: 3 },
        { id: "b", label: "B", x: 5, y: 0, width: 3, height: 3 },
        { id: "obstacle", label: "X", x: 3, y: 4, width: 3, height: 3 },
      ],
      edges: [{
        id: "edge",
        source: "a",
        target: "b",
        sourceEndpoint: {
          side: "right",
          anchor: { x: 2, y: 1 },
          marker: { x: 3, y: 1 },
          outward: { x: 1, y: 0 },
        },
        targetEndpoint: {
          side: "left",
          anchor: { x: 5, y: 1 },
          marker: { x: 4, y: 1 },
          outward: { x: -1, y: 0 },
        },
        points: [{ x: 2, y: 1 }, { x: 4, y: 5 }, { x: 6, y: 1 }],
      }],
    };

    expect(validateGridLayout(layout)).toContain("Edge edge contains a diagonal segment");
  });

  it("requires compound nodes to contain their direct children", () => {
    const layout: GridLayout = {
      width: 10,
      height: 10,
      groups: [{ id: "group", label: "G", x: 1, y: 1, width: 4, height: 4 }],
      nodes: [{
        id: "outside",
        label: "A",
        parentId: "group",
        x: 4,
        y: 4,
        width: 3,
        height: 3,
      }],
      edges: [],
    };

    expect(validateGridLayout(layout)).toContain(
      "Group group does not contain node outside",
    );
  });

  it("rejects endpoint markers that overlap their node border", () => {
    const layout: GridLayout = {
      width: 10,
      height: 5,
      groups: [],
      nodes: [
        { id: "a", label: "A", x: 0, y: 0, width: 3, height: 3 },
        { id: "b", label: "B", x: 6, y: 0, width: 3, height: 3 },
      ],
      edges: [{
        id: "edge",
        source: "a",
        target: "b",
        sourceEndpoint: {
          side: "right",
          anchor: { x: 2, y: 1 },
          marker: { x: 3, y: 1 },
          outward: { x: 1, y: 0 },
        },
        targetEndpoint: {
          side: "left",
          anchor: { x: 6, y: 1 },
          marker: { x: 6, y: 1 },
          outward: { x: -1, y: 0 },
        },
        points: [{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 5, y: 1 }, { x: 6, y: 1 }],
      }],
    };

    expect(validateGridLayout(layout)).toContain("Edge edge marker overlaps node b");
  });

  it("rejects shared ports and collinear cells for independent edges", () => {
    const endpoint = (
      side: "right" | "left",
      anchor: { x: number; y: number },
    ) => ({
      side,
      anchor,
      marker: { x: anchor.x + (side === "right" ? 1 : -1), y: anchor.y },
      outward: { x: side === "right" ? 1 : -1, y: 0 },
    });
    const layout: GridLayout = {
      width: 10,
      height: 5,
      groups: [],
      nodes: [
        { id: "a", label: "A", x: 0, y: 0, width: 3, height: 4 },
        { id: "b", label: "B", x: 7, y: 0, width: 3, height: 4 },
      ],
      edges: [
        {
          id: "first",
          source: "a",
          target: "b",
          routing: { topology: "independent", sourceClearance: 1, targetClearance: 1 },
          sourceEndpoint: endpoint("right", { x: 2, y: 1 }),
          targetEndpoint: endpoint("left", { x: 7, y: 1 }),
          points: [{ x: 2, y: 1 }, { x: 7, y: 1 }],
        },
        {
          id: "second",
          source: "a",
          target: "b",
          routing: { topology: "independent", sourceClearance: 1, targetClearance: 1 },
          sourceEndpoint: endpoint("right", { x: 2, y: 1 }),
          targetEndpoint: endpoint("left", { x: 7, y: 1 }),
          points: [{ x: 2, y: 1 }, { x: 7, y: 1 }],
        },
      ],
    };

    expect(validateGridLayout(layout)).toEqual(expect.arrayContaining([
      "Independent edges first and second share a node port",
      "Independent edges first and second share marker cells",
      "Independent edges first and second share collinear route cells",
    ]));
  });
});
