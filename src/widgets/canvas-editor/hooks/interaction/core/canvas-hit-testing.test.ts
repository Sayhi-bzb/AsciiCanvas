import { describe, expect, it } from "vitest";
import {
  findSelectedStructuredHandleHit,
  getStructuredHitCursor,
  getStructuredTextCaretHit,
  isFromCanvasUi,
  isFromMinimap,
  keepStructuredSplitLineHandle,
  resolveStructuredSelectHit,
  resolveStructuredSelectHover,
} from "@/widgets/canvas-editor/hooks/interaction/core/hitTesting";
import { gridCellRect } from "@/shared/metrics";
import type {
  StructuredBoxNode,
  StructuredSplitBoxNode,
  StructuredTextNode,
} from "@/shared/types";

const eventWithTarget = (target: EventTarget) =>
  ({ target, composedPath: () => [target] }) as unknown as Event;

const boxNode: StructuredBoxNode = {
  id: "box-1",
  type: "box",
  order: 1,
  start: { x: 1, y: 1 },
  end: { x: 5, y: 3 },
  style: { color: "#ffffff" },
};

const splitBoxNode: StructuredSplitBoxNode = {
  id: "split-1",
  type: "splitBox",
  order: 1,
  start: { x: 0, y: 0 },
  end: { x: 9, y: 5 },
  verticalSplitRatio: 0.5,
  topSplitRatio: 0.5,
  bottomSplitRatio: 0.5,
  style: { color: "#ffffff" },
};

const textNode: StructuredTextNode = {
  id: "text-1",
  type: "text",
  order: 1,
  position: { x: 2, y: 3 },
  text: "abc",
  style: { color: "#ffffff" },
};

describe("canvas hit testing helpers", () => {
  it("detects events from canvas UI and minimap surfaces", () => {
    const canvasUi = document.createElement("div");
    canvasUi.dataset.canvasUi = "true";
    const child = document.createElement("button");
    canvasUi.appendChild(child);

    const minimap = document.createElement("div");
    minimap.dataset.minimapRoot = "true";

    expect(isFromCanvasUi(eventWithTarget(child))).toBe(true);
    expect(isFromMinimap(eventWithTarget(minimap))).toBe(true);
    expect(isFromCanvasUi(eventWithTarget(document.createElement("div")))).toBe(
      false
    );
  });

  it("finds selected structured rect handles from screen points", () => {
    const handleCell = gridCellRect({ x: 6, y: 4 }, {
      offset: { x: 0, y: 0 },
      zoom: 1,
    });

    expect(
      findSelectedStructuredHandleHit({
        screenPoint: {
          x: handleCell.x,
          y: handleCell.y,
        },
        selectedStructuredNodeIds: [boxNode.id],
        structuredScene: [boxNode],
        offset: { x: 0, y: 0 },
        zoom: 1,
      })
    ).toMatchObject({
      kind: "box",
      handle: "se",
      node: { id: boxNode.id },
    });
  });

  it("keeps splitBox divider handles while stripping non-divider handles", () => {
    expect(
      keepStructuredSplitLineHandle({
        node: splitBoxNode,
        kind: "splitBox",
        handle: "split:split-middle",
      })
    ).toMatchObject({ handle: "split:split-middle" });

    expect(
      keepStructuredSplitLineHandle({
        node: boxNode,
        kind: "box",
        handle: "se",
      })
    ).toMatchObject({ kind: "box", handle: null });
  });

  it("returns cursor affordances for structured hits", () => {
    expect(
      getStructuredHitCursor(
        { node: boxNode, kind: "box", handle: "se" },
        null
      )
    ).toBe("nwse-resize");

    expect(
      getStructuredHitCursor(
        { node: textNode, kind: "text", handle: null },
        textNode.id
      )
    ).toBe("text");
  });

  it("finds structured text caret hits by preferred text node", () => {
    const hit = getStructuredTextCaretHit({
      point: { x: 3, y: 3 },
      structuredScene: [textNode],
      preferredNodeId: textNode.id,
    });

    expect(hit?.hit.node.id).toBe(textNode.id);
    expect(hit?.offset).toBe(1);
    expect(hit?.caretPoint).toEqual({ x: 3, y: 3 });
  });

  it("resolves structured select start hits without caret behind handles", () => {
    const handleCell = gridCellRect({ x: 6, y: 4 }, {
      offset: { x: 0, y: 0 },
      zoom: 1,
    });

    const hit = resolveStructuredSelectHit({
      screenPoint: { x: handleCell.x, y: handleCell.y },
      point: { x: 3, y: 3 },
      selectedStructuredNodeIds: [boxNode.id],
      structuredScene: [textNode, boxNode],
      offset: { x: 0, y: 0 },
      zoom: 1,
      editingStructuredTextNodeId: textNode.id,
      includeCaretBehindHandle: false,
    });

    expect(hit.hit).toMatchObject({
      kind: "box",
      handle: "se",
      node: { id: boxNode.id },
    });
    expect(hit.caretHit).toBeNull();
    expect(hit.cursor).toBe("nwse-resize");
  });
  it("resolves structured select hover with handle priority", () => {
    const handleCell = gridCellRect({ x: 6, y: 4 }, {
      offset: { x: 0, y: 0 },
      zoom: 1,
    });

    const hover = resolveStructuredSelectHover({
      screenPoint: { x: handleCell.x, y: handleCell.y },
      point: { x: 3, y: 3 },
      selectedStructuredNodeIds: [boxNode.id],
      structuredScene: [textNode, boxNode],
      offset: { x: 0, y: 0 },
      zoom: 1,
      editingStructuredTextNodeId: textNode.id,
    });

    expect(hover.hit).toMatchObject({
      kind: "box",
      handle: "se",
      node: { id: boxNode.id },
    });
    expect(hover.caretHit?.hit.node.id).toBe(textNode.id);
    expect(hover.cursor).toBe("nwse-resize");
  });

  it("resolves structured select hover from caret before node hits", () => {
    const hover = resolveStructuredSelectHover({
      screenPoint: null,
      point: { x: 3, y: 3 },
      selectedStructuredNodeIds: [],
      structuredScene: [boxNode, textNode],
      offset: { x: 0, y: 0 },
      zoom: 1,
      editingStructuredTextNodeId: textNode.id,
    });

    expect(hover.hit).toMatchObject({ kind: "text", node: { id: textNode.id } });
    expect(hover.cursor).toBe("text");
  });

  it("returns an empty cursor when structured select hover has no hit", () => {
    const hover = resolveStructuredSelectHover({
      screenPoint: null,
      point: { x: 20, y: 20 },
      selectedStructuredNodeIds: [],
      structuredScene: [boxNode, textNode],
      offset: { x: 0, y: 0 },
      zoom: 1,
      editingStructuredTextNodeId: null,
    });

    expect(hover.hit).toBeNull();
    expect(hover.caretHit).toBeNull();
    expect(hover.cursor).toBe("");
  });});
