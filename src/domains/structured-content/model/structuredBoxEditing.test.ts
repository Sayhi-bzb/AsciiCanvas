import { describe, expect, it } from "vitest";
import type { StructuredBgNode, StructuredBoxNode, StructuredNode, StructuredSplitBoxNode } from "@/domains/structured-content/public";
import {
  addStructuredSplitBoxSplit,
  canSplitStructuredSplitBoxLeaf,
  deleteStructuredSplitBoxSplit,
  findStructuredBoxHit,
  findStructuredNodeHit,
  findStructuredNodeIdsInSelection,
  getStructuredBoxNameEndPoint,
  getStructuredBoxNameStartPoint,
  getStructuredBoxHandleAtPoint,
  getStructuredSplitBoxGuides,
  getStructuredSplitBoxHandleAtPoint,
  getStructuredSplitBoxLeafAtPoint,
  isPointOnStructuredBoxBorder,
  moveStructuredBox,
  moveStructuredNode,
  resizeStructuredBox,
  resizeStructuredRect,
  resizeStructuredLine,
  resizeStructuredSplitBox,
} from "@/domains/structured-content/public";

const box = (overrides: Partial<StructuredBoxNode> = {}): StructuredBoxNode => ({
  id: "box-1",
  type: "box",
  order: 1,
  start: { x: 2, y: 3 },
  end: { x: 6, y: 7 },
  style: { color: "#ffffff" },
  ...overrides,
});

const bg = (overrides: Partial<StructuredBgNode> = {}): StructuredBgNode => ({
  id: "bg-1",
  type: "bg",
  order: 1,
  start: { x: 0, y: 0 },
  end: { x: 4, y: 4 },
  style: { color: "#ffffff", bgColor: "#2563eb" },
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

  it("hits top-most structured nodes across boxes, lines, and text", () => {
    const scene: StructuredNode[] = [
      box({ id: "box-1", order: 1, start: { x: 0, y: 0 }, end: { x: 10, y: 4 } }),
      {
        id: "line-1",
        type: "line",
        order: 2,
        start: { x: 2, y: 2 },
        end: { x: 8, y: 2 },
        axis: "horizontal",
        style: { color: "#ffffff" },
      },
      {
        id: "text-1",
        type: "text",
        order: 3,
        position: { x: 2, y: 2 },
        text: "top",
        style: { color: "#ffffff" },
      },
    ];

    expect(findStructuredNodeHit(scene, { x: 2, y: 2 })).toMatchObject({
      kind: "text",
      node: { id: "text-1" },
    });
    expect(findStructuredNodeHit(scene, { x: 8, y: 2 })).toMatchObject({
      kind: "line",
      handle: "end",
      node: { id: "line-1" },
    });
    expect(findStructuredNodeHit(scene, { x: 0, y: 0 })).toMatchObject({
      kind: "box",
      handle: "nw",
      node: { id: "box-1" },
    });
  });

  it("hits background nodes as move targets unless they are selected", () => {
    const scene: StructuredNode[] = [bg()];

    expect(findStructuredNodeHit(scene, { x: 0, y: 0 })).toMatchObject({
      kind: "bg",
      handle: null,
      node: { id: "bg-1" },
    });
    expect(findStructuredNodeHit(scene, { x: 2, y: 2 })).toMatchObject({
      kind: "bg",
      handle: null,
      node: { id: "bg-1" },
    });
    expect(findStructuredNodeHit(scene, { x: 0, y: 0 }, ["bg-1"])).toMatchObject({
      kind: "bg",
      handle: null,
      node: { id: "bg-1" },
    });
    expect(findStructuredNodeHit(scene, { x: 2, y: 0 }, ["bg-1"])).toMatchObject({
      kind: "bg",
      handle: null,
      node: { id: "bg-1" },
    });
  });

  it("keeps background node hits as move targets for thin backgrounds", () => {
    const singleRow = bg({ start: { x: 0, y: 0 }, end: { x: 4, y: 0 } });
    const singleColumn = bg({ start: { x: 2, y: 0 }, end: { x: 2, y: 4 } });

    const scene: StructuredNode[] = [singleRow];
    expect(findStructuredNodeHit(scene, { x: 2, y: 0 }, ["bg-1"])).toMatchObject({
      kind: "bg",
      handle: null,
    });
    expect(findStructuredNodeHit(scene, { x: 4, y: 0 }, ["bg-1"])).toMatchObject({
      kind: "bg",
      handle: null,
    });
    expect(findStructuredNodeHit([singleColumn], { x: 2, y: 2 }, ["bg-1"])).toMatchObject({
      kind: "bg",
      handle: null,
    });
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

  it("resolves name cursor positions and border hits", () => {
    const node = box({ name: "API", end: { x: 10, y: 7 } });

    expect(getStructuredBoxNameStartPoint(node)).toEqual({ x: 5, y: 3 });
    expect(getStructuredBoxNameEndPoint(node)).toEqual({ x: 8, y: 3 });
    expect(isPointOnStructuredBoxBorder(node, { x: 3, y: 3 })).toBe(true);
    expect(isPointOnStructuredBoxBorder(node, { x: 4, y: 4 })).toBe(false);
    expect(
      getStructuredBoxNameStartPoint(
        box({ start: { x: 0, y: 0 }, end: { x: 3, y: 2 } })
      )
    ).toBeNull();
  });

  it("resolves CJK name cursor positions by display columns", () => {
    const node = box({ name: "接口", end: { x: 12, y: 7 } });

    expect(getStructuredBoxNameStartPoint(node)).toEqual({ x: 5, y: 3 });
    expect(getStructuredBoxNameEndPoint(node)).toEqual({ x: 9, y: 3 });
  });

  it("clamps name end point to the visible overflow text", () => {
    const node = box({ name: "接口API", start: { x: 0, y: 0 }, end: { x: 6, y: 2 } });

    expect(getStructuredBoxNameStartPoint(node)).toEqual({ x: 3, y: 0 });
    expect(getStructuredBoxNameEndPoint(node)).toEqual({ x: 5, y: 0 });
  });

  it("moves a box without changing its size", () => {
    expect(moveStructuredBox(box(), { x: 3, y: -2 })).toMatchObject({
      start: { x: 5, y: 1 },
      end: { x: 9, y: 5 },
    });
  });

  it("moves line and text structured nodes", () => {
    expect(
      moveStructuredNode(
        {
          id: "line-1",
          type: "line",
          order: 1,
          start: { x: 1, y: 1 },
          end: { x: 4, y: 1 },
          axis: "horizontal",
          style: { color: "#ffffff" },
        },
        { x: 2, y: 3 }
      )
    ).toMatchObject({
      start: { x: 3, y: 4 },
      end: { x: 6, y: 4 },
    });

    expect(
      moveStructuredNode(
        {
          id: "text-1",
          type: "text",
          order: 1,
          position: { x: 5, y: 6 },
          text: "label",
          style: { color: "#ffffff" },
        },
        { x: -2, y: 1 }
      )
    ).toMatchObject({
      position: { x: 3, y: 7 },
    });
  });

  it("resizes line endpoints and recalculates axis", () => {
    const line = {
      id: "line-1",
      type: "line" as const,
      order: 1,
      start: { x: 1, y: 1 },
      end: { x: 4, y: 1 },
      axis: "horizontal" as const,
      style: { color: "#ffffff" },
    };

    expect(resizeStructuredLine(line, "end", { x: 1, y: 8 })).toMatchObject({
      start: { x: 1, y: 1 },
      end: { x: 1, y: 8 },
      axis: "vertical",
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

  it("resizes background nodes with the shared rectangle logic", () => {
    expect(resizeStructuredRect(bg(), "e", { x: 9, y: 4 })).toMatchObject({
      type: "bg",
      start: { x: 0, y: 0 },
      end: { x: 9, y: 4 },
    });
    expect(resizeStructuredRect(bg(), "nw", { x: 8, y: 9 })).toMatchObject({
      type: "bg",
      start: { x: 4, y: 4 },
      end: { x: 8, y: 9 },
    });
  });

  it("hits and resizes split boxes as rectangle nodes", () => {
    const splitBox: StructuredSplitBoxNode = {
      id: "split-1",
      type: "splitBox",
      order: 1,
      start: { x: 0, y: 0 },
      end: { x: 10, y: 4 },
      verticalSplitRatio: 0.36,
      topSplitRatio: 0.25,
      bottomSplitRatio: 0.75,
      style: { color: "#000000" },
    };

    expect(findStructuredNodeHit([splitBox], { x: 0, y: 0 })).toMatchObject({
      kind: "splitBox",
      handle: "nw",
      node: { id: "split-1" },
    });
    expect(findStructuredNodeHit([splitBox], { x: 4, y: 2 })).toMatchObject({
      kind: "splitBox",
      handle: "split:split-middle",
    });
    expect(getStructuredSplitBoxHandleAtPoint(splitBox, { x: 5, y: 1 })).toBe(
      "split:split-top"
    );
    expect(getStructuredSplitBoxHandleAtPoint(splitBox, { x: 5, y: 3 })).toBe(
      "split:split-bottom"
    );
    expect(resizeStructuredSplitBox(splitBox, "e", { x: 12, y: 2 })).toMatchObject({
      type: "splitBox",
      start: { x: 0, y: 0 },
      end: { x: 12, y: 4 },
      verticalSplitRatio: 0.36,
    });
    expect(resizeStructuredSplitBox(splitBox, "split:split-middle", { x: 6, y: 2 })).toMatchObject({
      verticalSplitRatio: 0.6,
      topSplitRatio: 0.25,
      bottomSplitRatio: 0.75,
    });
    expect(resizeStructuredSplitBox(splitBox, "split:split-top", { x: 5, y: 2 })).toMatchObject({
      topSplitRatio: 0.5,
      bottomSplitRatio: 0.75,
    });
    expect(resizeStructuredSplitBox(splitBox, "split:split-bottom", { x: 5, y: 2 })).toMatchObject({
      topSplitRatio: 0.25,
      bottomSplitRatio: 0.5,
    });
  });

  it("deletes a split box split line without deleting the split box", () => {
    const splitBox: StructuredSplitBoxNode = {
      id: "split-1",
      type: "splitBox",
      order: 1,
      start: { x: 0, y: 0 },
      end: { x: 10, y: 4 },
      verticalSplitRatio: 0.36,
      topSplitRatio: 0.25,
      bottomSplitRatio: 0.75,
      style: { color: "#000000" },
    };

    const nextSplitBox = deleteStructuredSplitBoxSplit(
      splitBox,
      "split:split-middle"
    );

    expect(nextSplitBox.type).toBe("splitBox");
    expect(getStructuredSplitBoxHandleAtPoint(nextSplitBox, { x: 4, y: 2 })).toBeNull();
    expect(getStructuredSplitBoxHandleAtPoint(nextSplitBox, { x: 5, y: 1 })).toBe(
      "split:split-top"
    );
    expect(getStructuredSplitBoxHandleAtPoint(nextSplitBox, { x: 5, y: 3 })).toBe(
      "split:split-bottom"
    );
  });

  it("adds a split line to the split box leaf at a point", () => {
    const splitBox: StructuredSplitBoxNode = {
      id: "split-1",
      type: "splitBox",
      order: 1,
      start: { x: 0, y: 0 },
      end: { x: 10, y: 8 },
      verticalSplitRatio: 0.36,
      topSplitRatio: 0.25,
      bottomSplitRatio: 0.75,
      style: { color: "#000000" },
    };

    const leaf = getStructuredSplitBoxLeafAtPoint(splitBox, { x: 2, y: 4 });

    expect(leaf).not.toBeNull();
    expect(leaf && canSplitStructuredSplitBoxLeaf(leaf, "horizontal")).toBe(true);
    const nextSplitBox = addStructuredSplitBoxSplit(
      splitBox,
      leaf!.id,
      "horizontal"
    );
    const guides = getStructuredSplitBoxGuides(nextSplitBox);

    expect(guides.handles).toHaveLength(4);
    expect(guides.handles.some((handle) => handle.id === leaf!.id)).toBe(false);
    expect(
      guides.handles.some(
        (handle) => handle.axis === "horizontal" && handle.id.startsWith("split-")
      )
    ).toBe(true);
  });
});

