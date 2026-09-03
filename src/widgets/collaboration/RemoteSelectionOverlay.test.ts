import { describe, expect, it } from "vitest";
import type { StructuredNode } from "@/domains/structured-content/public";
import type { GridMap } from "@/shared/types";
import { resolveRemoteSelectionVisuals } from "./remoteSelectionGeometry";

const viewport = {
  offset: { x: 10, y: 20 },
  zoom: 2,
};

describe("resolveRemoteSelectionVisuals", () => {
  it("uses the shared grid geometry for cells, ranges, and CJK footprints", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "界", color: "#000000" }],
    ]);
    const visuals = resolveRemoteSelectionVisuals({
      peers: [{
        clientId: 7,
        name: "Ada",
        color: "#0969da",
        selection: {
          mode: "freeform",
          areas: [
            { start: { x: 1, y: 0 }, end: { x: 1, y: 0 } },
            { start: { x: 3, y: 2 }, end: { x: 5, y: 3 } },
          ],
        },
      }],
      canvasMode: "freeform",
      grid,
      structuredScene: [],
      viewport,
    });

    expect(visuals).toHaveLength(1);
    expect(visuals[0]).toMatchObject({
      clientId: 7,
      name: "Ada",
      color: "#0969da",
      anchor: { x: 10, y: 20 },
    });
    expect(visuals[0].path).toContain("M10 20");
    expect(visuals[0].path).toContain("46 20");
  });

  it("outlines selected structured nodes and ignores missing ids", () => {
    const scene: StructuredNode[] = [{
      id: "note",
      type: "text",
      order: 0,
      position: { x: 4, y: 3 },
      text: "hello",
      style: { color: "#000000" },
    }];
    const visuals = resolveRemoteSelectionVisuals({
      peers: [{
        clientId: 8,
        name: "Lin",
        color: "#bf3989",
        selection: { mode: "structured", nodeIds: ["missing", "note"] },
      }],
      canvasMode: "structured",
      grid: new Map(),
      structuredScene: scene,
      viewport,
    });

    expect(visuals).toEqual([expect.objectContaining({
      clientId: 8,
      anchor: { x: 82, y: 134 },
      path: "M82 134 H172 V172 H82 Z",
    })]);
  });

  it("does not project selections from another canvas mode", () => {
    expect(resolveRemoteSelectionVisuals({
      peers: [{
        clientId: 9,
        name: "Kai",
        color: "#1a7f37",
        selection: { mode: "structured", nodeIds: ["node"] },
      }],
      canvasMode: "freeform",
      grid: new Map(),
      structuredScene: [],
      viewport,
    })).toEqual([]);
  });
});
