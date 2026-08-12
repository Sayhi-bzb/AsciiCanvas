import { describe, expect, it } from "vitest";
import { resolveDragEndCommitDecision } from "@/widgets/canvas-editor/hooks/interaction/commit/commitInteraction";
import type { CanvasInteractionState, StructuredNodeDragPayload } from "@/domains/editor/public";

const drag: StructuredNodeDragPayload = {
  node: {
    id: "box-1", type: "box", order: 1,
    start: { x: 0, y: 0 }, end: { x: 4, y: 2 },
    style: { color: "#fff" },
  },
  selectedIds: ["box-1"],
  selectedNodes: [],
  baseScene: [],
  baseGrid: new Map(),
  handle: null,
};

const resolve = (
  state: CanvasInteractionState,
  options: { tool?: "brush" | "eraser" | "box" | "splitBox" | "select"; divider?: boolean } = {}
) => resolveDragEndCommitDecision({
  state,
  tool: options.tool ?? "select",
  canvasMode: state.type.startsWith("structured") ? "structured" : "freeform",
  isStructuredSplitBoxDividerResize: options.divider ?? false,
});

describe("drag-end commit interaction decisions", () => {
  it("commits brush scratches and saves eraser history", () => {
    expect(resolve({
      type: "drawing", tool: "brush", start: { x: 0, y: 0 },
      lastGrid: { x: 1, y: 0 }, lastPlacedGrid: { x: 1, y: 0 },
    }, { tool: "brush" })).toEqual({ type: "commitScratch" });
    expect(resolve({
      type: "drawing", tool: "eraser", start: { x: 0, y: 0 },
      lastGrid: { x: 1, y: 0 }, lastPlacedGrid: { x: 0, y: 0 },
    }, { tool: "eraser" })).toEqual({ type: "forceHistorySave" });
  });

  it("commits freeform and structured shape previews through their owners", () => {
    expect(resolve({ type: "shapePreview", tool: "box", start: { x: 0, y: 0 }, axis: null }, { tool: "box" }))
      .toEqual({ type: "commitScratch" });
    expect(resolveDragEndCommitDecision({
      state: { type: "shapePreview", tool: "splitBox", start: { x: 0, y: 0 }, axis: null },
      tool: "splitBox", canvasMode: "structured",
      isStructuredSplitBoxDividerResize: false,
    })).toEqual({ type: "commitStructuredShape" });
    expect(resolveDragEndCommitDecision({
      state: { type: "shapePreview", tool: "arrowLine", start: { x: 0, y: 0 }, axis: null },
      tool: "arrowLine", canvasMode: "structured",
      isStructuredSplitBoxDividerResize: false,
    })).toEqual({ type: "commitStructuredShape" });
  });

  it("flushes structured move and splitBox divider queues", () => {
    expect(resolve({ type: "structuredMoving", anchor: { x: 0, y: 0 }, drag }))
      .toEqual({ type: "flushStructuredMove" });
    expect(resolve({
      type: "structuredSplitBoxResizing", anchor: { x: 0, y: 0 },
      drag: { ...drag, handle: "split:split-middle" },
    }, { divider: true })).toEqual({ type: "flushStructuredSplitBoxResize" });
  });

  it("saves history for direct structured resize writes", () => {
    expect(resolve({
      type: "structuredRectResizing", anchor: { x: 0, y: 0 },
      drag: { ...drag, handle: "se" },
    })).toEqual({ type: "forceHistorySave" });
    expect(resolve({
      type: "structuredLineResizing", anchor: { x: 0, y: 0 },
      drag: { ...drag, handle: "end" },
    })).toEqual({ type: "forceHistorySave" });
  });
});
