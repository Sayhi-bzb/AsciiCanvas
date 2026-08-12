import { describe, expect, it, vi } from "vitest";
import {
  executePrimaryDragEnd,
  resolvePrimaryDragEndContext,
  type PrimaryDragEndExecutor,
} from "@/widgets/canvas-editor/hooks/interaction/gestures/dragEndExecution";
import type { StructuredNodeDragPayload } from "@/domains/editor/public";

const drag: StructuredNodeDragPayload = {
  node: {
    id: "box-1", type: "box", order: 1,
    start: { x: 0, y: 0 }, end: { x: 4, y: 2 }, style: { color: "#fff" },
  },
  selectedIds: ["box-1"], selectedNodes: [], baseScene: [], baseGrid: new Map(), handle: null,
};

const createPrimaryExecutor = (): PrimaryDragEndExecutor => ({
  flushSelectionPreview: vi.fn(),
  getSelectionPreview: vi.fn(() => ({ start: { x: 1, y: 1 }, end: { x: 2, y: 2 } })),
  fillArea: vi.fn(), setSelectedStructuredNodeIds: vi.fn(),
  setSelectedStructuredSplitHandle: vi.fn(), setStructuredGridFocus: vi.fn(),
  setTextCursor: vi.fn(), addSelection: vi.fn(), clearSelections: vi.fn(),
  clearSelectionPreview: vi.fn(), commitScratch: vi.fn(), forceHistorySave: vi.fn(),
  commitStructuredShape: vi.fn(), flushStructuredMove: vi.fn(),
  flushStructuredSplitBoxResize: vi.fn(), resetDragState: vi.fn(),
});

describe("canvas drag-end execution", () => {
  it("derives shape commit geometry from typed state", () => {
    expect(resolvePrimaryDragEndContext({
      state: { type: "shapePreview", tool: "line", start: { x: 1, y: 2 }, axis: "vertical" },
      tool: "line", canvasMode: "freeform", structuredScene: [],
      resolvedEndGrid: { x: 4, y: 8 }, isDividerHandle: () => false,
    })).toMatchObject({
      dragStart: { x: 1, y: 2 }, endGrid: { x: 4, y: 8 }, axis: "vertical",
    });
  });

  it("commits selection and resets interaction state", () => {
    const executor = createPrimaryExecutor();
    expect(executePrimaryDragEnd({
      state: { type: "selecting", anchor: { x: 1, y: 1 }, current: { x: 2, y: 2 } },
      tool: "select", canvasMode: "freeform", structuredScene: [],
      dragStart: { x: 1, y: 1 }, endGrid: { x: 2, y: 2 }, axis: null,
      splitBoxDividerResize: false,
    }, executor)).toBe(true);
    expect(executor.addSelection).toHaveBeenCalled();
    expect(executor.resetDragState).toHaveBeenCalled();
  });

  it("flushes structured move before resetting", () => {
    const executor = createPrimaryExecutor();
    executePrimaryDragEnd({
      state: { type: "structuredMoving", anchor: { x: 0, y: 0 }, drag },
      tool: "select", canvasMode: "structured", structuredScene: [drag.node],
      dragStart: { x: 0, y: 0 }, endGrid: { x: 2, y: 2 }, axis: null,
      splitBoxDividerResize: false,
    }, executor);
    expect(executor.flushStructuredMove).toHaveBeenCalled();
    expect(executor.resetDragState).toHaveBeenCalled();
  });
});
