import { describe, expect, it, vi } from "vitest";
import {
  createNonPanningDragEndExecutor,
  createPanningDragEndExecutor,
  createPrimaryDragEndExecutor,
  executeNonPanningDragEndCleanup,
  executePanningDragEnd,
  executePrimaryDragEnd,
  isStructuredSplitBoxDividerDrag,
  resolvePrimaryDragEndContext,
  type PanningDragEndExecutor,
  type PrimaryDragEndExecutor,
} from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/gestures/dragEndExecution";
import type { StructuredBoxNode, StructuredSplitBoxNode } from "@/shared/types";

const boxNode: StructuredBoxNode = {
  id: "box-1",
  type: "box",
  order: 1,
  start: { x: 0, y: 0 },
  end: { x: 4, y: 2 },
  style: { color: "#ffffff" },
};

const splitBoxNode: StructuredSplitBoxNode = {
  id: "split-1",
  type: "splitBox",
  order: 2,
  start: { x: 0, y: 0 },
  end: { x: 8, y: 4 },
  verticalSplitRatio: 0.5,
  topSplitRatio: 0.5,
  bottomSplitRatio: 0.5,
  style: { color: "#ffffff" },
};

const createPanningExecutor = (): PanningDragEndExecutor => ({
  flushOffset: vi.fn(),
  setIsPanning: vi.fn(),
  dispatchInteraction: vi.fn(),
  setBodyCursor: vi.fn(),
  clearLinkHover: vi.fn(),
});

const createPrimaryExecutor = (): PrimaryDragEndExecutor => ({
  flushSelectionPreview: vi.fn(),
  getSelectionPreview: vi.fn(() => ({
    start: { x: 1, y: 1 },
    end: { x: 3, y: 3 },
  })),
  resetDragState: vi.fn(),
  fillArea: vi.fn(),
  setSelectedStructuredNodeIds: vi.fn(),
  setSelectedStructuredSplitHandle: vi.fn(),
  setStructuredGridFocus: vi.fn(),
  setTextCursor: vi.fn(),
  addSelection: vi.fn(),
  clearSelections: vi.fn(),
  clearSelectionPreview: vi.fn(),
  commitScratch: vi.fn(),
  forceHistorySave: vi.fn(),
  commitStructuredShape: vi.fn(),
  flushStructuredMove: vi.fn(),
  flushStructuredSplitBoxResize: vi.fn(),
});

describe("drag-end execution", () => {
  it("executes panning drag ends", () => {
    const executor = createPanningExecutor();

    executePanningDragEnd(executor);

    expect(executor.flushOffset).toHaveBeenCalledTimes(1);
    expect(executor.setIsPanning).toHaveBeenCalledWith(false);
    expect(executor.dispatchInteraction).toHaveBeenCalledWith({ type: "reset" });
    expect(executor.setBodyCursor).toHaveBeenCalledWith("auto");
    expect(executor.clearLinkHover).toHaveBeenCalledTimes(1);
  });

  it("creates panning drag-end executors that bind refs and callbacks", () => {
    const isPanning = { current: true };
    const flushOffset = vi.fn();
    const dispatchInteraction = vi.fn();
    const setBodyCursor = vi.fn();
    const clearLinkHover = vi.fn();
    const executor = createPanningDragEndExecutor({
      isPanning,
      flushOffset,
      dispatchInteraction,
      setBodyCursor,
      clearLinkHover,
    });

    executor.flushOffset();
    executor.setIsPanning(false);
    executor.dispatchInteraction({ type: "reset" });
    executor.setBodyCursor("auto");
    executor.clearLinkHover();

    expect(flushOffset).toHaveBeenCalledTimes(1);
    expect(isPanning.current).toBe(false);
    expect(dispatchInteraction).toHaveBeenCalledWith({ type: "reset" });
    expect(setBodyCursor).toHaveBeenCalledWith("auto");
    expect(clearLinkHover).toHaveBeenCalledTimes(1);
  });
  it("executes non-panning drag-end cleanup", () => {
    const setBodyCursor = vi.fn();
    const executor = createNonPanningDragEndExecutor({ setBodyCursor });

    executeNonPanningDragEndCleanup(executor);

    expect(setBodyCursor).toHaveBeenCalledWith("auto");
  });
  it("resolves primary drag-end context with fallback end-grid and divider status", () => {
    expect(
      resolvePrimaryDragEndContext({
        mode: "structured-splitbox-resizing",
        tool: "select",
        canvasMode: "structured",
        structuredScene: [splitBoxNode],
        dragStart: { x: 1, y: 1 },
        resolvedEndGrid: null,
        axis: null,
        dragNodeType: "splitBox",
        dragHandle: "split:split-middle",
        isDividerHandle: (handle) => handle.startsWith("split:"),
      })
    ).toEqual({
      mode: "structured-splitbox-resizing",
      tool: "select",
      canvasMode: "structured",
      structuredScene: [splitBoxNode],
      dragStart: { x: 1, y: 1 },
      endGrid: { x: 1, y: 1 },
      axis: null,
      splitBoxDividerResize: true,
    });
  });

  it("executes selecting drag ends and resets drag state", () => {
    const executor = createPrimaryExecutor();

    expect(
      executePrimaryDragEnd(
        {
          mode: "selecting",
          tool: "select",
          canvasMode: "freeform",
          structuredScene: [],
          dragStart: { x: 1, y: 1 },
          endGrid: { x: 3, y: 3 },
          axis: null,
          splitBoxDividerResize: false,
        },
        executor
      )
    ).toBe(true);

    expect(executor.flushSelectionPreview).toHaveBeenCalledTimes(1);
    expect(executor.addSelection).toHaveBeenCalledWith({
      start: { x: 1, y: 1 },
      end: { x: 3, y: 3 },
    });
    expect(executor.clearSelectionPreview).toHaveBeenCalledTimes(1);
    expect(executor.resetDragState).toHaveBeenCalledTimes(1);
  });

  it("executes freeform shape drag-end commits", () => {
    const executor = createPrimaryExecutor();

    expect(
      executePrimaryDragEnd(
        {
          mode: "shape-preview",
          tool: "circle",
          canvasMode: "freeform",
          structuredScene: [],
          dragStart: { x: 1, y: 1 },
          endGrid: { x: 4, y: 4 },
          axis: null,
          splitBoxDividerResize: false,
        },
        executor
      )
    ).toBe(true);

    expect(executor.commitScratch).toHaveBeenCalledTimes(1);
    expect(executor.resetDragState).toHaveBeenCalledTimes(1);
  });

  it("executes structured shape drag-end commits", () => {
    const executor = createPrimaryExecutor();

    executePrimaryDragEnd(
      {
        mode: "shape-preview",
        tool: "line",
        canvasMode: "structured",
        structuredScene: [boxNode],
        dragStart: { x: 1, y: 1 },
        endGrid: { x: 4, y: 1 },
        axis: "horizontal",
        splitBoxDividerResize: false,
      },
      executor
    );

    expect(executor.commitStructuredShape).toHaveBeenCalledWith(
      "line",
      { x: 1, y: 1 },
      { x: 4, y: 1 },
      { axis: "horizontal" }
    );
    expect(executor.resetDragState).toHaveBeenCalledTimes(1);
  });

  it("executes splitBox divider resize flushes", () => {
    const executor = createPrimaryExecutor();

    executePrimaryDragEnd(
      {
        mode: "structured-splitbox-resizing",
        tool: "select",
        canvasMode: "structured",
        structuredScene: [splitBoxNode],
        dragStart: { x: 1, y: 1 },
        endGrid: { x: 4, y: 2 },
        axis: null,
        splitBoxDividerResize: true,
      },
      executor
    );

    expect(executor.flushStructuredSplitBoxResize).toHaveBeenCalledTimes(1);
    expect(executor.forceHistorySave).not.toHaveBeenCalled();
  });

  it("ignores non-primary drag-end modes", () => {
    const executor = createPrimaryExecutor();

    expect(
      executePrimaryDragEnd(
        {
          mode: "idle",
          tool: "select",
          canvasMode: "freeform",
          structuredScene: [],
          dragStart: null,
          endGrid: { x: 0, y: 0 },
          axis: null,
          splitBoxDividerResize: false,
        },
        executor
      )
    ).toBe(false);
    expect(executor.resetDragState).not.toHaveBeenCalled();
  });

  it("identifies splitBox divider drags", () => {
    expect(
      isStructuredSplitBoxDividerDrag({
        nodeType: "splitBox",
        handle: "split:split-middle",
        isDividerHandle: (handle) => handle.startsWith("split:"),
      })
    ).toBe(true);
    expect(
      isStructuredSplitBoxDividerDrag({
        nodeType: "splitBox",
        handle: "se",
        isDividerHandle: (handle) => handle.startsWith("split:"),
      })
    ).toBe(false);
  });
  it("creates primary drag-end executors that bind preview and structured queues", () => {
    const selectionPreview = {
      set: vi.fn(),
      get: vi.fn(() => ({ start: { x: 1, y: 1 }, end: { x: 2, y: 2 } })),
      flush: vi.fn(),
      cancel: vi.fn(),
    };
    const structuredPreviewQueue = {
      queueMove: vi.fn(),
      queueSplitBoxResize: vi.fn(),
      flushMove: vi.fn(),
      flushSplitBoxResize: vi.fn(),
      clearLastMove: vi.fn(),
      clearLastSplitBoxResize: vi.fn(),
      cancel: vi.fn(),
    };
    const executor = createPrimaryDragEndExecutor({
      selectionPreview,
      structuredPreviewQueue,
      fillArea: vi.fn(),
      setSelectedStructuredNodeIds: vi.fn(),
      setSelectedStructuredSplitHandle: vi.fn(),
      setStructuredGridFocus: vi.fn(),
      setTextCursor: vi.fn(),
      addSelection: vi.fn(),
      clearSelections: vi.fn(),
      commitScratch: vi.fn(),
      forceHistorySave: vi.fn(),
      commitStructuredShape: vi.fn(),
      resetDragState: vi.fn(),
    });

    executor.flushSelectionPreview();
    expect(executor.getSelectionPreview()).toEqual({
      start: { x: 1, y: 1 },
      end: { x: 2, y: 2 },
    });
    executor.clearSelectionPreview();
    executor.flushStructuredMove();
    executor.flushStructuredSplitBoxResize();

    expect(selectionPreview.flush).toHaveBeenCalledTimes(1);
    expect(selectionPreview.set).toHaveBeenCalledWith(null, { immediate: true });
    expect(structuredPreviewQueue.flushMove).toHaveBeenCalledWith(true);
    expect(structuredPreviewQueue.flushSplitBoxResize).toHaveBeenCalledWith(true);
  });
});
