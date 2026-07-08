import { describe, expect, it, vi } from "vitest";
import {
  createStructuredSelectStartHandler,
  createStructuredSelectStartExecutor,
  executeStructuredSelectStartDecision,
  type StructuredSelectStartExecutor,
} from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/structured/structuredSelectExecution";
import type {
  StructuredBoxNode,
  StructuredTextNode,
} from "@/shared/types";

const boxNode: StructuredBoxNode = {
  id: "box-1",
  type: "box",
  order: 1,
  start: { x: 1, y: 1 },
  end: { x: 5, y: 3 },
  style: { color: "#ffffff" },
};

const textNode: StructuredTextNode = {
  id: "text-1",
  type: "text",
  order: 2,
  position: { x: 2, y: 2 },
  text: "abc",
  style: { color: "#ffffff" },
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
  setStructuredNodeDrag: vi.fn(),
  setDragStartGrid: vi.fn(),
  setStructuredTextSelectionStart: vi.fn(),
  dispatchInteraction: vi.fn(),
});

describe("structured select start execution", () => {
  it("executes double-click text starts and stops drag-start routing", () => {
    const executor = createExecutor();

    expect(
      executeStructuredSelectStartDecision(
        { type: "double-click-text", nodeId: textNode.id },
        { x: 2, y: 2 },
        executor
      )
    ).toBe(true);

    expect(executor.setSelectedStructuredNodeIds).toHaveBeenCalledWith([
      textNode.id,
    ]);
    expect(executor.setSelectedStructuredSplitHandle).toHaveBeenCalledWith(null);
    expect(executor.clearSelections).toHaveBeenCalledTimes(1);
    expect(executor.setSelectionPreview).toHaveBeenCalledWith(null);
    expect(executor.resetDragState).toHaveBeenCalledTimes(1);
    expect(executor.setCursor).toHaveBeenCalledWith("text");
  });

  it("executes active text caret selection starts", () => {
    const executor = createExecutor();
    const start = { x: 3, y: 2 };
    const caretHit = {
      hit: { node: textNode, kind: "text" as const, handle: null },
      offset: 1,
      caretPoint: start,
    };

    expect(
      executeStructuredSelectStartDecision(
        { type: "text-caret-selection", node: textNode, caretHit },
        start,
        executor
      )
    ).toBe(true);

    expect(executor.setSelectedStructuredNodeIds).toHaveBeenCalledWith([
      textNode.id,
    ]);
    expect(executor.setTextCursor).toHaveBeenCalledWith(start);
    expect(executor.setStructuredTextSelection).toHaveBeenCalledWith(null);
    expect(executor.setStructuredTextSelectionStart).toHaveBeenCalledWith({
      nodeId: textNode.id,
      offset: 1,
    });
    expect(executor.setDragStartGrid).toHaveBeenCalledWith(start);
    expect(executor.dispatchInteraction).toHaveBeenCalledWith({
      type: "startStructuredTextSelecting",
      nodeId: textNode.id,
      anchorOffset: 1,
    });
    expect(executor.setSelectionPreview).toHaveBeenCalledWith(null);
    expect(executor.setCursor).toHaveBeenCalledWith("text");
  });

  it("executes node drag starts", () => {
    const executor = createExecutor();
    const start = { x: 2, y: 2 };
    const drag = {
      node: boxNode,
      selectedIds: [boxNode.id],
      selectedNodes: [boxNode],
      baseScene: [],
      baseGrid: new Map(),
      handle: null,
    };
    const interactionEvent = {
      type: "startStructuredMoving" as const,
      ids: [boxNode.id],
      anchor: start,
      baseScene: [],
    };

    expect(
      executeStructuredSelectStartDecision(
        {
          type: "node-drag",
          cursor: "move",
          dragStart: {
            selectedIds: [boxNode.id],
            contextPoint: null,
            splitHandle: null,
            drag,
            interactionEvent,
          },
        },
        start,
        executor
      )
    ).toBe(true);

    expect(executor.setSelectedStructuredNodeIds).toHaveBeenCalledWith([
      boxNode.id,
    ]);
    expect(executor.setStructuredContextPoint).toHaveBeenCalledWith(null);
    expect(executor.setSelectedStructuredSplitHandle).toHaveBeenCalledWith(null);
    expect(executor.setEditingStructuredTextNodeId).toHaveBeenCalledWith(null);
    expect(executor.setStructuredTextSelection).toHaveBeenCalledWith(null);
    expect(executor.setStructuredNodeDrag).toHaveBeenCalledWith(drag);
    expect(executor.setDragStartGrid).toHaveBeenCalledWith(start);
    expect(executor.dispatchInteraction).toHaveBeenCalledWith(interactionEvent);
    expect(executor.setCursor).toHaveBeenCalledWith("move");
    expect(executor.setTextCursor).toHaveBeenCalledWith(null);
    expect(executor.clearSelections).toHaveBeenCalledTimes(1);
  });

  it("executes empty clears but allows later drag-start routing to continue", () => {
    const executor = createExecutor();

    expect(
      executeStructuredSelectStartDecision(
        { type: "clear-empty" },
        { x: 9, y: 9 },
        executor
      )
    ).toBe(false);

    expect(executor.setSelectedStructuredNodeIds).toHaveBeenCalledWith([]);
    expect(executor.setSelectedStructuredSplitHandle).toHaveBeenCalledWith(null);
    expect(executor.setStructuredContextPoint).toHaveBeenCalledWith(null);
    expect(executor.setEditingStructuredTextNodeId).toHaveBeenCalledWith(null);
    expect(executor.setStructuredTextSelection).toHaveBeenCalledWith(null);
    expect(executor.setCursor).toHaveBeenCalledWith("");
  });

  it("ignores none decisions", () => {
    const executor = createExecutor();

    expect(
      executeStructuredSelectStartDecision(
        { type: "none" },
        { x: 1, y: 1 },
        executor
      )
    ).toBe(false);
    expect(executor.setSelectedStructuredNodeIds).not.toHaveBeenCalled();
  });

  it("creates structured select executors that update hook refs", () => {
    const dragStartGrid = { current: null };
    const structuredNodeDrag = { current: null };
    const structuredTextSelectionStart = { current: null };
    const setSelectionPreview = vi.fn();
    const dispatchInteraction = vi.fn();
    const executor = createStructuredSelectStartExecutor({
      dragStartGrid,
      structuredNodeDrag,
      structuredTextSelectionStart,
      setSelectedStructuredNodeIds: vi.fn(),
      setSelectedStructuredSplitHandle: vi.fn(),
      setStructuredContextPoint: vi.fn(),
      setEditingStructuredTextNodeId: vi.fn(),
      setStructuredTextSelection: vi.fn(),
      setTextCursor: vi.fn(),
      clearSelections: vi.fn(),
      setSelectionPreview,
      resetDragState: vi.fn(),
      setCursor: vi.fn(),
      dispatchInteraction,
    });
    const drag = {
      node: boxNode,
      selectedIds: [boxNode.id],
      selectedNodes: [boxNode],
      baseScene: [],
      baseGrid: new Map(),
      handle: null,
    };

    executor.setStructuredNodeDrag(drag);
    executor.setDragStartGrid({ x: 1, y: 2 });
    executor.setStructuredTextSelectionStart({ nodeId: textNode.id, offset: 1 });
    executor.setSelectionPreview(null);
    executor.dispatchInteraction({ type: "reset" });

    expect(structuredNodeDrag.current).toBe(drag);
    expect(dragStartGrid.current).toEqual({ x: 1, y: 2 });
    expect(structuredTextSelectionStart.current).toEqual({
      nodeId: textNode.id,
      offset: 1,
    });
    expect(setSelectionPreview).toHaveBeenCalledWith(null);
    expect(dispatchInteraction).toHaveBeenCalledWith({ type: "reset" });
  });

  it("creates structured select start handlers that resolve context and execute decisions", () => {
    const executor = createExecutor();
    const handler = createStructuredSelectStartHandler({
      selectedStructuredNodeIds: [],
      structuredScene: [],
      offset: { x: 0, y: 0 },
      zoom: 1,
      editingStructuredTextNodeId: null,
      executor,
    });

    expect(
      handler({
        screenPoint: { x: 10, y: 10 },
        start: { x: 1, y: 1 },
        mouseDetail: 1,
      })
    ).toBe(false);

    expect(executor.setSelectedStructuredNodeIds).toHaveBeenCalledWith([]);
    expect(executor.setSelectedStructuredSplitHandle).toHaveBeenCalledWith(null);
    expect(executor.setStructuredContextPoint).toHaveBeenCalledWith(null);
    expect(executor.setEditingStructuredTextNodeId).toHaveBeenCalledWith(null);
    expect(executor.setStructuredTextSelection).toHaveBeenCalledWith(null);
    expect(executor.setCursor).toHaveBeenCalledWith("");
  });
});
