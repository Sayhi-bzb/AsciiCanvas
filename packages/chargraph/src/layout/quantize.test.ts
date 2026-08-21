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
        { id: "a", label: "A", shape: "rectangle", x: 0, y: 0, width: 3, height: 3 },
        { id: "b", label: "B", shape: "rectangle", x: 5, y: 0, width: 3, height: 3 },
        { id: "obstacle", label: "X", shape: "rectangle", x: 3, y: 4, width: 3, height: 3 },
      ],
      edges: [{
        id: "edge",
        source: "a",
        target: "b",
        labelWidth: 0,
        style: "solid",
        hasArrowStart: false,
        hasArrowEnd: true,
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
        shape: "rectangle",
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
});
