import { describe, expect, it } from "vitest";
import type { CanvasSession } from "@/domains/sessions/public";
import type { StructuredNode } from "@/domains/structured-content/public";
import type { StructuredComponentInstance } from "@/domains/structured-content/public";
import { resolveSessionRuntime } from "./storeUtils";

const textNode: StructuredNode = {
  id: "text-1",
  type: "text",
  order: 1,
  position: { x: 2, y: 3 },
  text: "Cached",
  style: { color: "#111111" },
};

describe("resolveSessionRuntime", () => {
  it("reuses a normalized structured session and its cached grid", () => {
    const grid: CanvasSession["grid"] = [
      ["2,3", { char: "C", color: "#111111" }],
    ];
    const scene = [textNode];
    const components: StructuredComponentInstance[] = [];
    const session: CanvasSession = {
      id: "structured-cached",
      name: "Structured Cached",
      mode: "structured",
      scene,
      components,
      grid,
    };

    const runtime = resolveSessionRuntime(session, "select");

    expect(runtime.nextScene).toBe(scene);
    expect(runtime.nextComponents).toBe(components);
    expect(runtime.nextGridEntries).toBe(grid);
  });

  it("does not synthesize a duplicate grid when structured content has only a scene", () => {
    const scene = [textNode];
    const session: CanvasSession = {
      id: "structured-missing-grid",
      name: "Structured Missing Grid",
      mode: "structured",
      scene,
      components: [],
      grid: [],
    };

    const runtime = resolveSessionRuntime(session, "select");

    expect(runtime.nextScene).toBe(scene);
    expect(runtime.nextGridEntries).toBe(session.grid);
    expect(runtime.nextGridEntries).toEqual([]);
  });
});
