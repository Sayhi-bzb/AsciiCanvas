import { describe, expect, it } from "vitest";
import { createStructuredSceneSurface } from "./surface";
import { sceneToGridEntries } from "./scene";
import type { StructuredNode } from "./types";

const scene: StructuredNode[] = [
  {
    id: "background",
    type: "bg",
    start: { x: -4, y: -2 },
    end: { x: 140, y: 70 },
    order: 1,
    style: { color: "#fff", bgColor: "#123456" },
  },
  {
    id: "box",
    type: "box",
    start: { x: 2, y: 1 },
    end: { x: 20, y: 6 },
    name: "模型",
    order: 2,
    style: { color: "#abcdef" },
  },
  {
    id: "text",
    type: "text",
    position: { x: 127, y: 4 },
    text: "A界B",
    order: 3,
    style: { color: "#fedcba" },
  },
];

describe("StructuredSceneSurfaceIndex", () => {
  it("matches the canonical structured projection across chunk boundaries", () => {
    const surface = createStructuredSceneSurface(scene);
    const expected = new Map(sceneToGridEntries(scene));

    expect(surface.materialize()).toEqual(expected);
    expect(surface.getCell({ x: 127, y: 4 })).toEqual(expected.get("127,4"));
    expect(surface.getCell({ x: 128, y: 4 })).toEqual(expected.get("128,4"));
    expect(surface.getCell({ x: 129, y: 4 })).toEqual(expected.get("129,4"));
  });

  it("only resolves chunks intersecting a viewport query", () => {
    const surface = createStructuredSceneSurface(scene);

    const rows = Array.from(surface.rows({ x: 0, y: 0, width: 24, height: 10 }));

    expect(rows.length).toBeGreaterThan(0);
    expect(surface.getStats()).toMatchObject({
      residentChunks: 1,
      resolvedChunks: 1,
      materializations: 0,
    });
  });

  it("does not retain more than the chunk cache budget", () => {
    const surface = createStructuredSceneSurface(scene);

    for (let index = 0; index < 80; index += 1) {
      surface.getCell({ x: index * 128, y: 0 });
    }

    expect(surface.getStats().residentChunks).toBeLessThanOrEqual(64);
  });
});
