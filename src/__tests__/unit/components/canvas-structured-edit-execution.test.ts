import { describe, expect, it, vi } from "vitest";
import {
  createStructuredEditController,
  executeStructuredEditDecision,
  type StructuredEditExecutor,
} from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/structured/structuredEditExecution";

const createExecutor = (): StructuredEditExecutor => ({
  setSelectedStructuredNodeIds: vi.fn(),
  setSelectedStructuredSplitHandle: vi.fn(),
  clearSelections: vi.fn(),
  setTextCursor: vi.fn(),
  setEditingStructuredTextNodeId: vi.fn(),
  setStructuredTextSelection: vi.fn(),
  setSelectionPreview: vi.fn(),
  resetDragState: vi.fn(),
  setCursor: vi.fn(),
});

describe("structured edit execution", () => {
  it("ignores none decisions", () => {
    const executor = createExecutor();

    expect(executeStructuredEditDecision({ type: "none" }, executor)).toBe(
      false
    );
    expect(executor.setSelectedStructuredNodeIds).not.toHaveBeenCalled();
  });

  it("executes text edit decisions", () => {
    const executor = createExecutor();
    const cursor = { x: 3, y: 4 };

    expect(
      executeStructuredEditDecision(
        { type: "text", nodeId: "text-1", cursor },
        executor
      )
    ).toBe(true);

    expect(executor.setSelectedStructuredNodeIds).toHaveBeenCalledWith([
      "text-1",
    ]);
    expect(executor.setSelectedStructuredSplitHandle).toHaveBeenCalledWith(null);
    expect(executor.clearSelections).toHaveBeenCalledTimes(1);
    expect(executor.setTextCursor).toHaveBeenCalledWith(cursor);
    expect(executor.setEditingStructuredTextNodeId).toHaveBeenCalledWith(
      "text-1"
    );
    expect(executor.setStructuredTextSelection).toHaveBeenCalledWith(null);
    expect(executor.setSelectionPreview).toHaveBeenCalledWith(null);
    expect(executor.resetDragState).toHaveBeenCalledTimes(1);
    expect(executor.setCursor).toHaveBeenCalledWith("text");
  });

  it("executes box-name edit decisions without marking text node editing", () => {
    const executor = createExecutor();
    const cursor = { x: 5, y: 1 };

    expect(
      executeStructuredEditDecision(
        { type: "box-name", nodeId: "box-1", cursor },
        executor
      )
    ).toBe(true);

    expect(executor.setSelectedStructuredNodeIds).toHaveBeenCalledWith([
      "box-1",
    ]);
    expect(executor.setTextCursor).toHaveBeenCalledWith(cursor);
    expect(executor.setEditingStructuredTextNodeId).toHaveBeenCalledWith(null);
    expect(executor.setCursor).toHaveBeenCalledWith("text");
  });

  it("controller resolves and executes structured edit attempts", () => {
    const executor = createExecutor();
    const controller = createStructuredEditController({
      getCanvasMode: () => "structured",
      getTool: () => "select",
      resolvePoint: () => ({ x: 2, y: 0 }),
      getStructuredScene: () => [
        {
          id: "text-1",
          type: "text",
          order: 1,
          position: { x: 0, y: 0 },
          text: "Edit",
          style: { color: "#ffffff" },
        },
      ],
      getSelectedStructuredNodeIds: () => [],
      getEditingStructuredTextNodeId: () => null,
      executor,
    });

    expect(controller.startEdit(10, 20)).toBe(true);
    expect(executor.setSelectedStructuredNodeIds).toHaveBeenCalledWith([
      "text-1",
    ]);
    expect(executor.setTextCursor).toHaveBeenCalledWith({ x: 2, y: 0 });
    expect(executor.setCursor).toHaveBeenCalledWith("text");
  });

  it("controller ignores non-structured edit attempts", () => {
    const executor = createExecutor();
    const controller = createStructuredEditController({
      getCanvasMode: () => "freeform",
      getTool: () => "select",
      resolvePoint: () => ({ x: 2, y: 0 }),
      getStructuredScene: () => [],
      getSelectedStructuredNodeIds: () => [],
      getEditingStructuredTextNodeId: () => null,
      executor,
    });

    expect(controller.startEdit(10, 20)).toBe(false);
    expect(executor.setSelectedStructuredNodeIds).not.toHaveBeenCalled();
  });
});
