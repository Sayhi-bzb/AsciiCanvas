import { describe, expect, it, vi } from "vitest";
import {
  createStructuredSelectStartExecutor,
  executeStructuredSelectStartDecision,
  type StructuredSelectStartExecutor,
} from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/structured/structuredSelectExecution";
import { resolveStructuredDragStartDecision } from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/structured/structuredDragStart";
import type { StructuredBoxNode, StructuredTextNode } from "@/shared/types";

const textNode: StructuredTextNode = {
  id: "text-1", type: "text", order: 1,
  position: { x: 1, y: 2 }, text: "hello", style: { color: "#fff" },
};
const boxNode: StructuredBoxNode = {
  id: "box-1", type: "box", order: 2,
  start: { x: 0, y: 0 }, end: { x: 4, y: 3 }, style: { color: "#fff" },
};

const createExecutor = (): StructuredSelectStartExecutor => ({
  setSelectedStructuredNodeIds: vi.fn(),
  setSelectedStructuredSplitHandle: vi.fn(),
  setStructuredContextPoint: vi.fn(),
  setEditingStructuredTextNodeId: vi.fn(),
  setStructuredTextSelection: vi.fn(),
  setTextCursor: vi.fn(),
  clearSelections: vi.fn(),
  setSelectionPreview: vi.fn(),
  resetDragState: vi.fn(),
  setCursor: vi.fn(),
  dispatchInteraction: vi.fn(),
});

describe("structured select start execution", () => {
  it("dispatches structured text selection with its anchor", () => {
    const executor = createExecutor();
    expect(executeStructuredSelectStartDecision({
      type: "text-caret-selection",
      node: textNode,
      caretHit: {
        hit: { kind: "text", node: textNode, handle: null },
        offset: 2,
        caretPoint: { x: 3, y: 2 },
      },
    }, { x: 3, y: 2 }, executor)).toBe(true);
    expect(executor.dispatchInteraction).toHaveBeenCalledWith({
      type: "startStructuredTextSelecting",
      nodeId: textNode.id,
      anchorOffset: 2,
      start: { x: 3, y: 2 },
    });
  });

  it("dispatches the complete structured drag payload", () => {
    const executor = createExecutor();
    const start = { x: 1, y: 1 };
    const dragStart = resolveStructuredDragStartDecision({
      hit: { kind: "box", node: boxNode, handle: null },
      start,
      selectedStructuredNodeIds: [boxNode.id],
      structuredScene: [boxNode],
    });
    expect(executeStructuredSelectStartDecision({
      type: "node-drag", dragStart, cursor: "move",
    }, start, executor)).toBe(true);
    expect(executor.dispatchInteraction).toHaveBeenCalledWith({
      type: "startStructuredMoving",
      anchor: start,
      drag: dragStart.drag,
    });
  });

  it("clears empty structured hits without starting a drag", () => {
    const executor = createExecutor();
    expect(executeStructuredSelectStartDecision(
      { type: "clear-empty" }, { x: 8, y: 8 }, executor
    )).toBe(false);
    expect(executor.setSelectedStructuredNodeIds).toHaveBeenCalledWith([]);
    expect(executor.dispatchInteraction).not.toHaveBeenCalled();
  });

  it("creates an executor without hook-owned transient refs", () => {
    const dispatchInteraction = vi.fn();
    const executor = createStructuredSelectStartExecutor({
      setSelectedStructuredNodeIds: vi.fn(), setSelectedStructuredSplitHandle: vi.fn(),
      setStructuredContextPoint: vi.fn(), setEditingStructuredTextNodeId: vi.fn(),
      setStructuredTextSelection: vi.fn(), setTextCursor: vi.fn(), clearSelections: vi.fn(),
      setSelectionPreview: vi.fn(), resetDragState: vi.fn(), setCursor: vi.fn(),
      dispatchInteraction,
    });
    executor.dispatchInteraction({
      type: "startStructuredTextSelecting", nodeId: "text-1", anchorOffset: 0,
      start: { x: 1, y: 2 },
    });
    expect(dispatchInteraction).toHaveBeenCalled();
  });
});
