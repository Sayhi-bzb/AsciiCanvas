import { describe, expect, it } from "vitest";
import type { StructuredBoxNode, StructuredNode } from "@/shared/types";
import {
  findStructuredBoxHit,
  findStructuredNodeIdsInSelection,
  getStructuredBoxHandleAtPoint,
  moveStructuredBox,
  resizeStructuredBox,
} from "@/domains/canvas/state/helpers/structuredBoxEditing";

const box = (overrides: Partial<StructuredBoxNode> = {}): StructuredBoxNode => ({
  id: "box-1",
  type: "box",
  order: 1,
  start: { x: 2, y: 3 },
  end: { x: 6, y: 7 },
  style: { color: "#ffffff" },
  ...overrides,
});

describe("structuredBoxEditing", () => {
  it("hits the top-most box and reports resize handles", () => {
    const scene: StructuredNode[] = [
      box({ id: "back", order: 1 }),
      box({ id: "front", order: 2, start: { x: 4, y: 4 }, end: { x: 8, y: 8 } }),
    ];

    expect(findStructuredBoxHit(scene, { x: 4, y: 4 })).toMatchObject({
      node: { id: "front" },
      handle: "nw",
    });
    expect(findStructuredBoxHit(scene, { x: 5, y: 5 })).toMatchObject({
      node: { id: "front" },
      handle: null,
    });
    expect(findStructuredBoxHit(scene, { x: 20, y: 20 })).toBeNull();
  });

  it("detects edge and corner handles", () => {
    const node = box();

    expect(getStructuredBoxHandleAtPoint(node, { x: 2, y: 3 })).toBe("nw");
    expect(getStructuredBoxHandleAtPoint(node, { x: 4, y: 3 })).toBe("n");
    expect(getStructuredBoxHandleAtPoint(node, { x: 6, y: 5 })).toBe("e");
    expect(getStructuredBoxHandleAtPoint(node, { x: 4, y: 5 })).toBeNull();
  });

  it("selects every structured node intersecting a marquee area", () => {
    const scene: StructuredNode[] = [
      box({ id: "box-1", order: 1, start: { x: 2, y: 2 }, end: { x: 5, y: 5 } }),
      {
        id: "line-1",
        type: "line",
        order: 2,
        start: { x: 8, y: 2 },
        end: { x: 12, y: 2 },
        axis: "horizontal",
        style: { color: "#ffffff" },
      },
      {
        id: "text-1",
        type: "text",
        order: 3,
        position: { x: 20, y: 2 },
        text: "label",
        style: { color: "#ffffff" },
      },
    ];

    expect(
      findStructuredNodeIdsInSelection(scene, {
        start: { x: 4, y: 1 },
        end: { x: 9, y: 3 },
      })
    ).toEqual(["box-1", "line-1"]);
  });

  it("moves a box without changing its size", () => {
    expect(moveStructuredBox(box(), { x: 3, y: -2 })).toMatchObject({
      start: { x: 5, y: 1 },
      end: { x: 9, y: 5 },
    });
  });

  it("resizes the requested side or corner and normalizes reversed coordinates", () => {
    expect(resizeStructuredBox(box(), "e", { x: 9, y: 4 })).toMatchObject({
      start: { x: 2, y: 3 },
      end: { x: 9, y: 7 },
    });
    expect(resizeStructuredBox(box(), "nw", { x: 8, y: 9 })).toMatchObject({
      start: { x: 6, y: 7 },
      end: { x: 8, y: 9 },
    });
  });
});
