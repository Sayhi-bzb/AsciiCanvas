import { describe, expect, it, vi } from "vitest";
import {
  executeDragEndCommitDecision,
  executeSelectionCommitDecision,
  type DragEndCommitExecutor,
  type SelectionCommitExecutor,
} from "@/widgets/canvas-editor/hooks/interaction/commit/commitExecution";

const createSelectionExecutor = (): SelectionCommitExecutor => ({
  fillArea: vi.fn(),
  setSelectedStructuredNodeIds: vi.fn(),
  setSelectedStructuredSplitHandle: vi.fn(),
  setStructuredGridFocus: vi.fn(),
  setStaticGridActiveCell: vi.fn(),
  setStaticGridSelectionRange: vi.fn(),
  appendStaticGridSelectionRange: vi.fn(),
  clearSelections: vi.fn(),
  clearSelectionPreview: vi.fn(),
});

const createDragExecutor = (): DragEndCommitExecutor => ({
  commitScratch: vi.fn(),
  forceHistorySave: vi.fn(),
  commitStructuredShape: vi.fn(),
  flushStructuredMove: vi.fn(),
  flushStructuredSplitBoxResize: vi.fn(),
});

describe("commit execution helpers", () => {
  it("executes structured selection commits and clears the preview", () => {
    const executor = createSelectionExecutor();

    executeSelectionCommitDecision(
      { type: "setStructuredSelection", ids: ["box-1"] },
      executor
    );

    expect(executor.setSelectedStructuredNodeIds).toHaveBeenCalledWith([
      "box-1",
    ]);
    expect(executor.setSelectedStructuredSplitHandle).toHaveBeenCalledWith(null);
    expect(executor.clearSelections).toHaveBeenCalledTimes(1);
    expect(executor.clearSelectionPreview).toHaveBeenCalledTimes(1);
  });

  it("does not clear selection preview for none commits", () => {
    const executor = createSelectionExecutor();

    executeSelectionCommitDecision({ type: "none" }, executor);

    expect(executor.clearSelectionPreview).not.toHaveBeenCalled();
  });

  it("commits a static-grid active cell through its dedicated command", () => {
    const executor = createSelectionExecutor();

    executeSelectionCommitDecision(
      { type: "setStaticGridActiveCell", point: { x: 4, y: 7 } },
      executor
    );

    expect(executor.setStaticGridActiveCell).toHaveBeenCalledWith({ x: 4, y: 7 });
    expect(executor.clearSelectionPreview).toHaveBeenCalledTimes(1);
  });

  it("replaces a static-grid range through its dedicated command", () => {
    const executor = createSelectionExecutor();
    const selection = { start: { x: 4, y: 7 }, end: { x: 6, y: 9 } };

    executeSelectionCommitDecision(
      { type: "setStaticGridSelectionRange", selection },
      executor
    );

    expect(executor.setStaticGridSelectionRange).toHaveBeenCalledWith(selection);
    expect(executor.appendStaticGridSelectionRange).not.toHaveBeenCalled();
  });

  it("executes direct drag-end commit effects", () => {
    const executor = createDragExecutor();

    executeDragEndCommitDecision(
      { type: "commitScratch" },
      executor,
      {
        tool: "brush",
        startGrid: { x: 1, y: 2 },
        endGrid: { x: 3, y: 4 },
        axis: null,
      }
    );
    executeDragEndCommitDecision(
      { type: "flushStructuredMove" },
      executor,
      {
        tool: "select",
        startGrid: { x: 1, y: 2 },
        endGrid: { x: 3, y: 4 },
        axis: null,
      }
    );

    expect(executor.commitScratch).toHaveBeenCalledTimes(1);
    expect(executor.flushStructuredMove).toHaveBeenCalledTimes(1);
  });

  it("commits structured shapes only with a drag start and structured shape tool", () => {
    const executor = createDragExecutor();

    executeDragEndCommitDecision(
      { type: "commitStructuredShape" },
      executor,
      {
        tool: "line",
        startGrid: { x: 1, y: 2 },
        endGrid: { x: 3, y: 4 },
        axis: "horizontal",
      }
    );
    executeDragEndCommitDecision(
      { type: "commitStructuredShape" },
      executor,
      {
        tool: "circle",
        startGrid: { x: 1, y: 2 },
        endGrid: { x: 3, y: 4 },
        axis: null,
      }
    );
    executeDragEndCommitDecision(
      { type: "commitStructuredShape" },
      executor,
      {
        tool: "box",
        startGrid: null,
        endGrid: { x: 3, y: 4 },
        axis: null,
      }
    );

    expect(executor.commitStructuredShape).toHaveBeenCalledTimes(1);
    expect(executor.commitStructuredShape).toHaveBeenCalledWith(
      "line",
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { axis: "horizontal" }
    );
  });

  it("commits arrow lines through the structured shape executor", () => {
    const executor = createDragExecutor();

    executeDragEndCommitDecision(
      { type: "commitStructuredShape" },
      executor,
      {
        tool: "arrowLine",
        startGrid: { x: 1, y: 2 },
        endGrid: { x: 3, y: 4 },
        axis: "vertical",
      }
    );

    expect(executor.commitStructuredShape).toHaveBeenCalledWith(
      "arrowLine",
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { axis: "vertical" }
    );
  });
});
