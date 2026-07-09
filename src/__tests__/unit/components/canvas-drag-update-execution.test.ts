import { describe, expect, it, vi } from "vitest";
import {
  createPanningDragUpdateExecutor,
  createDragUpdateExecutor,
  createDragUpdateHandler,
  createDragUpdateRouteHandler,
  executeDragUpdateDecision,
  executePanningDragUpdate,
  type DragUpdateExecutor,
} from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/gestures/dragUpdateExecution";
import type {
  GridMap,
  StructuredBoxNode,
  StructuredLineNode,
  StructuredNode,
  StructuredSplitBoxNode,
} from "@/shared/types";
import type { StructuredNodeDragPayload } from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/structured/structuredDragStart";

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

const lineNode: StructuredLineNode = {
  id: "line-1",
  type: "line",
  order: 3,
  start: { x: 0, y: 0 },
  end: { x: 5, y: 0 },
  axis: "horizontal",
  style: { color: "#ffffff" },
};

const emptyGrid: GridMap = new Map();

const makeDrag = (
  node: StructuredNodeDragPayload["node"],
  handle: StructuredNodeDragPayload["handle"] = null
): StructuredNodeDragPayload => ({
  node,
  selectedIds: [node.id],
  selectedNodes: [node],
  baseScene: [],
  baseGrid: emptyGrid,
  handle,
});

const createExecutor = (): DragUpdateExecutor => ({
  dispatchInteraction: vi.fn(),
  setSelectionPreview: vi.fn(),
  draw: vi.fn(),
  queueStructuredMove: vi.fn(),
  queueStructuredSplitBoxResize: vi.fn(),
  updateStructuredNode: vi.fn(),
  setStructuredTextSelection: vi.fn(),
  setTextCursor: vi.fn(),
  setLineAxis: vi.fn(),
  updateScratchForShape: vi.fn(),
  setHoveredGrid: vi.fn(),
});

const context = (overrides: Partial<Parameters<typeof executeDragUpdateDecision>[2]> = {}) => ({
  currentGrid: { x: 3, y: 4 },
  tool: "select" as const,
  structuredScene: [boxNode, splitBoxNode, lineNode] as StructuredNode[],
  updateEraserHover: false,
  ...overrides,
});

describe("drag-update execution", () => {
  it("executes panning drag updates", () => {
    const queueOffsetDelta = vi.fn();
    const executor = createPanningDragUpdateExecutor({ queueOffsetDelta });

    executePanningDragUpdate({ x: 5, y: -3 }, executor);

    expect(queueOffsetDelta).toHaveBeenCalledWith(5, -3);
  });
  it("executes selection previews and updates interaction state", () => {
    const executor = createExecutor();
    const preview = { start: { x: 1, y: 1 }, end: { x: 3, y: 4 } };

    executeDragUpdateDecision(
      { type: "selection-preview", preview },
      executor,
      context()
    );

    expect(executor.dispatchInteraction).toHaveBeenCalledWith({
      type: "updateSelection",
      current: { x: 3, y: 4 },
    });
    expect(executor.setSelectionPreview).toHaveBeenCalledWith(preview);
  });

  it("executes drawing updates and eraser hover updates", () => {
    const executor = createExecutor();

    executeDragUpdateDecision(
      { type: "drawing", point: { x: 2, y: 2 } },
      executor,
      context({ tool: "eraser", updateEraserHover: true })
    );

    expect(executor.draw).toHaveBeenCalledWith({ x: 2, y: 2 });
    expect(executor.setHoveredGrid).toHaveBeenCalledWith({ x: 3, y: 4 });
  });

  it("queues structured move and splitBox divider previews with the current scene", () => {
    const executor = createExecutor();
    const drag = makeDrag(boxNode);
    const splitDrag = makeDrag(splitBoxNode, "split:split-middle");
    const scene = [boxNode, splitBoxNode];

    executeDragUpdateDecision(
      { type: "structured-move", drag, delta: { x: 2, y: -1 } },
      executor,
      context({ structuredScene: scene })
    );
    executeDragUpdateDecision(
      { type: "structured-splitbox-divider-resize", drag: splitDrag, point: { x: 4, y: 2 } },
      executor,
      context({ structuredScene: scene })
    );

    expect(executor.queueStructuredMove).toHaveBeenCalledWith(
      drag,
      { x: 2, y: -1 },
      scene
    );
    expect(executor.queueStructuredSplitBoxResize).toHaveBeenCalledWith(
      splitDrag,
      { x: 4, y: 2 },
      scene
    );
  });

  it("transitions pending splitBox divider resize before queueing preview", () => {
    const executor = createExecutor();
    const drag = makeDrag(splitBoxNode, "split:split-middle");
    const event = {
      type: "startStructuredResizing" as const,
      kind: "splitBox" as const,
      nodeId: splitBoxNode.id,
      handle: "split:split-middle" as const,
    };

    executeDragUpdateDecision(
      {
        type: "structured-splitbox-begin-divider-resize",
        drag,
        point: { x: 4, y: 2 },
        interactionEvent: event,
      },
      executor,
      context()
    );

    expect(executor.dispatchInteraction).toHaveBeenCalledWith(event);
    expect(executor.queueStructuredSplitBoxResize).toHaveBeenCalledWith(
      drag,
      { x: 4, y: 2 },
      [boxNode, splitBoxNode, lineNode]
    );
  });

  it("executes structured node resizes through updateStructuredNode", () => {
    const executor = createExecutor();

    executeDragUpdateDecision(
      {
        type: "structured-rect-resize",
        node: boxNode,
        handle: "se",
        point: { x: 6, y: 3 },
      },
      executor,
      context()
    );

    expect(executor.updateStructuredNode).toHaveBeenCalledWith(
      boxNode.id,
      expect.any(Function),
      "merge"
    );
    const updater = vi.mocked(executor.updateStructuredNode).mock.calls[0][1];
    expect(updater(boxNode)).toMatchObject({
      id: boxNode.id,
      end: { x: 6, y: 3 },
    });
  });

  it("executes structured text selections", () => {
    const executor = createExecutor();
    const selection = { nodeId: "text-1", anchor: 1, focus: 4 };
    const cursor = { x: 6, y: 2 };

    executeDragUpdateDecision(
      { type: "structured-text-selection", selection, cursor },
      executor,
      context()
    );

    expect(executor.setStructuredTextSelection).toHaveBeenCalledWith(selection);
    expect(executor.setTextCursor).toHaveBeenCalledWith(cursor);
  });

  it("executes shape previews and axis transitions", () => {
    const executor = createExecutor();
    const event = { type: "setShapePreviewAxis" as const, axis: "horizontal" as const };

    executeDragUpdateDecision(
      {
        type: "shape-preview",
        update: {
          start: { x: 1, y: 1 },
          end: { x: 5, y: 1 },
          axis: "horizontal",
          interactionEvent: event,
        },
      },
      executor,
      context({ tool: "line" })
    );

    expect(executor.dispatchInteraction).toHaveBeenCalledWith(event);
    expect(executor.setLineAxis).toHaveBeenCalledWith("horizontal");
    expect(executor.updateScratchForShape).toHaveBeenCalledWith(
      "line",
      { x: 1, y: 1 },
      { x: 5, y: 1 },
      { axis: "horizontal" }
    );
  });
  it("creates drag update executors that bind queues and line axis refs", () => {
    const lineAxis = { current: null as "horizontal" | "vertical" | null };
    const structuredPreviewQueue = {
      queueMove: vi.fn(),
      queueSplitBoxResize: vi.fn(),
      flushMove: vi.fn(),
      flushSplitBoxResize: vi.fn(),
      clearLastMove: vi.fn(),
      clearLastSplitBoxResize: vi.fn(),
      cancel: vi.fn(),
    };
    const executor = createDragUpdateExecutor({
      lineAxis,
      dispatchInteraction: vi.fn(),
      setSelectionPreview: vi.fn(),
      draw: vi.fn(),
      structuredPreviewQueue,
      updateStructuredNode: vi.fn(),
      setStructuredTextSelection: vi.fn(),
      setTextCursor: vi.fn(),
      updateScratchForShape: vi.fn(),
      setHoveredGrid: vi.fn(),
    });
    const drag = makeDrag(boxNode);

    executor.queueStructuredMove(drag, { x: 1, y: 2 }, [boxNode]);
    executor.queueStructuredSplitBoxResize(drag, { x: 3, y: 4 }, [boxNode]);
    executor.setLineAxis("horizontal");

    expect(structuredPreviewQueue.queueMove).toHaveBeenCalledWith(
      drag,
      { x: 1, y: 2 },
      [boxNode]
    );
    expect(structuredPreviewQueue.queueSplitBoxResize).toHaveBeenCalledWith(
      drag,
      { x: 3, y: 4 },
      [boxNode]
    );
    expect(lineAxis.current).toBe("horizontal");
  });

  it("creates drag update handlers that resolve selection previews", () => {
    const executor = createExecutor();
    const handler = createDragUpdateHandler({ executor });

    handler({
      mode: "selecting",
      tool: "select",
      canvasMode: "freeform",
      dragStart: { x: 1, y: 1 },
      currentGrid: { x: 3, y: 4 },
      canvasBounds: null,
      drag: null,
      structuredScene: [boxNode],
      textSelectionStart: null,
      lineAxis: null,
    });

    expect(executor.dispatchInteraction).toHaveBeenCalledWith({
      type: "updateSelection",
      current: { x: 3, y: 4 },
    });
    expect(executor.setSelectionPreview).toHaveBeenCalledWith({
      start: { x: 1, y: 1 },
      end: { x: 3, y: 4 },
    });
  });

  it("creates drag update handlers that preserve eraser hover updates", () => {
    const executor = createExecutor();
    const handler = createDragUpdateHandler({ executor });

    handler({
      mode: "drawing",
      tool: "eraser",
      canvasMode: "freeform",
      dragStart: { x: 1, y: 1 },
      currentGrid: { x: 3, y: 4 },
      canvasBounds: null,
      drag: null,
      structuredScene: [boxNode],
      textSelectionStart: null,
      lineAxis: null,
    });

    expect(executor.draw).toHaveBeenCalledWith({ x: 3, y: 4 });
    expect(executor.setHoveredGrid).toHaveBeenCalledWith({ x: 3, y: 4 });
  });
  it("routes panning drag updates without resolving grid points", () => {
    const queueOffsetDelta = vi.fn();
    const handler = createDragUpdateRouteHandler({
      panning: createPanningDragUpdateExecutor({ queueOffsetDelta }),
    });
    const resolveCurrentGrid = vi.fn(() => ({ x: 2, y: 2 }));
    const executePrimaryUpdate = vi.fn();

    handler({
      mode: "panning",
      delta: { x: 5, y: -2 },
      dragStart: { x: 1, y: 1 },
      resolveCurrentGrid,
      executePrimaryUpdate,
    });

    expect(queueOffsetDelta).toHaveBeenCalledWith(5, -2);
    expect(resolveCurrentGrid).not.toHaveBeenCalled();
    expect(executePrimaryUpdate).not.toHaveBeenCalled();
  });

  it("skips non-panning drag updates without a drag start", () => {
    const handler = createDragUpdateRouteHandler({
      panning: createPanningDragUpdateExecutor({ queueOffsetDelta: vi.fn() }),
    });
    const resolveCurrentGrid = vi.fn(() => ({ x: 2, y: 2 }));
    const executePrimaryUpdate = vi.fn();

    handler({
      mode: "drawing",
      delta: { x: 1, y: 1 },
      dragStart: null,
      resolveCurrentGrid,
      executePrimaryUpdate,
    });

    expect(resolveCurrentGrid).not.toHaveBeenCalled();
    expect(executePrimaryUpdate).not.toHaveBeenCalled();
  });

  it("skips non-panning drag updates when the current grid cannot resolve", () => {
    const handler = createDragUpdateRouteHandler({
      panning: createPanningDragUpdateExecutor({ queueOffsetDelta: vi.fn() }),
    });
    const resolveCurrentGrid = vi.fn(() => null);
    const executePrimaryUpdate = vi.fn();

    handler({
      mode: "drawing",
      delta: { x: 1, y: 1 },
      dragStart: { x: 1, y: 1 },
      resolveCurrentGrid,
      executePrimaryUpdate,
    });

    expect(resolveCurrentGrid).toHaveBeenCalledTimes(1);
    expect(executePrimaryUpdate).not.toHaveBeenCalled();
  });

  it("routes non-panning drag updates through primary execution", () => {
    const handler = createDragUpdateRouteHandler({
      panning: createPanningDragUpdateExecutor({ queueOffsetDelta: vi.fn() }),
    });
    const currentGrid = { x: 3, y: 4 };
    const dragStart = { x: 1, y: 1 };
    const resolveCurrentGrid = vi.fn(() => currentGrid);
    const executePrimaryUpdate = vi.fn();

    handler({
      mode: "drawing",
      delta: { x: 1, y: 1 },
      dragStart,
      resolveCurrentGrid,
      executePrimaryUpdate,
    });

    expect(resolveCurrentGrid).toHaveBeenCalledTimes(1);
    expect(executePrimaryUpdate).toHaveBeenCalledWith(currentGrid, dragStart);
  });
});
