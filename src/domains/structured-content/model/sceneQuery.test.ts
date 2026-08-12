import { describe, expect, it } from "vitest";
import { createStructuredSceneQuery } from "./box";
import { sceneToGridEntries } from "./scene";
import type { StructuredNode } from "./types";

describe("StructuredSceneQuery", () => {
  it("reuses ordering and id lookup across hit queries", () => {
    const scene: StructuredNode[] = [
      {
        id: "back",
        type: "bg",
        start: { x: 0, y: 0 },
        end: { x: 4, y: 4 },
        order: 1,
        style: { color: "#fff" },
      },
      {
        id: "front",
        type: "box",
        start: { x: 1, y: 1 },
        end: { x: 3, y: 3 },
        order: 2,
        style: { color: "#fff" },
      },
    ];
    const query = createStructuredSceneQuery(scene);

    expect(query.getNode("front")?.id).toBe("front");
    expect(query.findHit({ x: 2, y: 2 })?.node.id).toBe("front");
    expect(query.findHit({ x: 0, y: 0 })?.node.id).toBe("back");
    expect(createStructuredSceneQuery(scene)).toBe(query);
    expect(sceneToGridEntries(scene)).toBe(sceneToGridEntries(scene));
  });

  it("keeps hit ordering with the large-scene spatial buckets", () => {
    const scene: StructuredNode[] = Array.from({ length: 10_000 }, (_, index) => ({
      id: `text-${index}`,
      type: "text" as const,
      position: { x: (index % 100) * 4, y: Math.floor(index / 100) * 2 },
      text: String(index),
      order: index,
      style: { color: "#fff" },
    }));
    scene.push({
      id: "front",
      type: "bg",
      start: { x: 0, y: 0 },
      end: { x: 10, y: 10 },
      order: 2_000,
      style: { color: "#fff" },
    });

    const query = createStructuredSceneQuery(scene);
    expect(query.findHit({ x: 4, y: 2 })?.node.id).toBe("front");
    expect(
      query.findNodeIdsInSelection({
        start: { x: 399, y: 198 },
        end: { x: 399, y: 198 },
      })
    ).toContain("text-9999");
  });
});
