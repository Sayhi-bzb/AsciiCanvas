import { describe, expect, it, vi } from "vitest";
import { GridManager } from "@/shared/utils/grid";
import {
  createStructuredMovePreviewQueue,
  createStructuredPreviewQueueController,
  createStructuredSplitBoxResizePreviewQueue,
  flushStructuredMovePreviewQueue,
  flushStructuredSplitBoxResizePreviewQueue,
  queueStructuredMovePreview,
  queueStructuredSplitBoxResizePreview,
} from "@/widgets/canvas-editor/hooks/interaction/structured/structuredPreviewQueueExecution";
import type { GridMap } from "@/shared/types";
import type { StructuredBoxNode, StructuredSplitBoxNode } from "@/domains/structured-content/public";
import type { StructuredNodeDragPayload } from "@/widgets/canvas-editor/hooks/interaction/structured/structuredDragStart";

const baseGrid: GridMap = new Map([
  [GridManager.toKey(0, 0), { char: "x", color: "#ffffff" }],
]);

const boxNode: StructuredBoxNode = {
  id: "box-1",
  type: "box",
  order: 1,
  start: { x: 1, y: 1 },
  end: { x: 5, y: 3 },
  style: { color: "#ffffff" },
};

const backgroundNode: StructuredBoxNode = {
  id: "box-2",
  type: "box",
  order: 2,
  start: { x: 8, y: 1 },
  end: { x: 10, y: 3 },
  style: { color: "#00ff00" },
};

const splitBoxNode: StructuredSplitBoxNode = {
  id: "split-1",
  type: "splitBox",
  order: 3,
  start: { x: 0, y: 0 },
  end: { x: 9, y: 5 },
  verticalSplitRatio: 0.5,
  topSplitRatio: 0.5,
  bottomSplitRatio: 0.5,
  style: { color: "#ffffff" },
};

const makeDrag = (
  node: StructuredNodeDragPayload["node"],
  handle: StructuredNodeDragPayload["handle"] = null
): StructuredNodeDragPayload => ({
  node,
  selectedIds: [node.id],
  selectedNodes: [node],
  baseScene: [backgroundNode],
  baseGrid,
  handle,
});

describe("structured preview queue execution", () => {
  it("flushes structured move previews through the preview callback", () => {
    const setStructuredMovePreview = vi.fn();
    const queue = createStructuredMovePreviewQueue({ setStructuredMovePreview });

    queueStructuredMovePreview(
      queue,
      makeDrag(boxNode),
      { x: 2, y: 3 },
      [boxNode, backgroundNode]
    );
    queue.flush();

    expect(setStructuredMovePreview).toHaveBeenCalledTimes(1);
    expect(setStructuredMovePreview.mock.calls[0][0].movingNodes[0]).toMatchObject({
      id: boxNode.id,
      start: { x: 3, y: 4 },
      end: { x: 7, y: 6 },
    });
  });

  it("commits the last structured move and clears the preview", () => {
    const queue = createStructuredMovePreviewQueue({
      setStructuredMovePreview: vi.fn(),
    });
    const applyStructuredScene = vi.fn();
    const clearStructuredMovePreview = vi.fn();

    queueStructuredMovePreview(
      queue,
      makeDrag(boxNode),
      { x: -1, y: 2 },
      [boxNode, backgroundNode]
    );

    flushStructuredMovePreviewQueue({
      queue,
      commit: true,
      applyStructuredScene,
      clearStructuredMovePreview,
    });

    expect(applyStructuredScene).toHaveBeenCalledWith(
      [
        {
          ...boxNode,
          start: { x: 0, y: 3 },
          end: { x: 4, y: 5 },
        },
        backgroundNode,
      ],
      true
    );
    expect(clearStructuredMovePreview).toHaveBeenCalledTimes(1);
  });

  it("commits splitBox divider resize previews", () => {
    const queue = createStructuredSplitBoxResizePreviewQueue({
      setStructuredMovePreview: vi.fn(),
    });
    const applyStructuredScene = vi.fn();
    const clearStructuredMovePreview = vi.fn();

    queueStructuredSplitBoxResizePreview(
      queue,
      makeDrag(splitBoxNode, "split:split-top"),
      { x: 2, y: 1 },
      [backgroundNode, splitBoxNode]
    );

    flushStructuredSplitBoxResizePreviewQueue({
      queue,
      commit: true,
      applyStructuredScene,
      clearStructuredMovePreview,
    });

    expect(applyStructuredScene).toHaveBeenCalledTimes(1);
    expect(applyStructuredScene.mock.calls[0][0][0]).toBe(backgroundNode);
    expect(applyStructuredScene.mock.calls[0][0][1]).toMatchObject({
      id: splitBoxNode.id,
      type: "splitBox",
    });
    expect(clearStructuredMovePreview).toHaveBeenCalledTimes(1);
  });

  it("does not commit invalid splitBox resize previews", () => {
    const queue = createStructuredSplitBoxResizePreviewQueue({
      setStructuredMovePreview: vi.fn(),
    });
    const applyStructuredScene = vi.fn();
    const clearStructuredMovePreview = vi.fn();

    queueStructuredSplitBoxResizePreview(
      queue,
      makeDrag(boxNode, "split:split-top"),
      { x: 2, y: 1 },
      [boxNode]
    );

    flushStructuredSplitBoxResizePreviewQueue({
      queue,
      commit: true,
      applyStructuredScene,
      clearStructuredMovePreview,
    });

    expect(applyStructuredScene).not.toHaveBeenCalled();
    expect(clearStructuredMovePreview).not.toHaveBeenCalled();
  });

  it("controller commits queued structured move previews", () => {
    const setStructuredMovePreview = vi.fn();
    const applyStructuredScene = vi.fn();
    const clearStructuredMovePreview = vi.fn();
    const controller = createStructuredPreviewQueueController({
      setStructuredMovePreview,
      applyStructuredScene,
      clearStructuredMovePreview,
    });

    controller.queueMove(
      makeDrag(boxNode),
      { x: 1, y: -1 },
      [boxNode, backgroundNode]
    );
    controller.flushMove(true);

    expect(applyStructuredScene).toHaveBeenCalledWith(
      [
        {
          ...boxNode,
          start: { x: 2, y: 0 },
          end: { x: 6, y: 2 },
        },
        backgroundNode,
      ],
      true
    );
    expect(setStructuredMovePreview).toHaveBeenCalledTimes(1);
    expect(clearStructuredMovePreview).toHaveBeenCalledTimes(1);
  });

  it("controller commits queued splitBox resize previews", () => {
    const applyStructuredScene = vi.fn();
    const clearStructuredMovePreview = vi.fn();
    const controller = createStructuredPreviewQueueController({
      setStructuredMovePreview: vi.fn(),
      applyStructuredScene,
      clearStructuredMovePreview,
    });

    controller.queueSplitBoxResize(
      makeDrag(splitBoxNode, "split:split-top"),
      { x: 2, y: 1 },
      [backgroundNode, splitBoxNode]
    );
    controller.flushSplitBoxResize(true);

    expect(applyStructuredScene).toHaveBeenCalledTimes(1);
    expect(applyStructuredScene.mock.calls[0][0][0]).toBe(backgroundNode);
    expect(applyStructuredScene.mock.calls[0][0][1]).toMatchObject({
      id: splitBoxNode.id,
      type: "splitBox",
    });
    expect(clearStructuredMovePreview).toHaveBeenCalledTimes(1);
  });

  it("controller clearLast prevents flushed previews from becoming commits", () => {
    const applyStructuredScene = vi.fn();
    const controller = createStructuredPreviewQueueController({
      setStructuredMovePreview: vi.fn(),
      applyStructuredScene,
      clearStructuredMovePreview: vi.fn(),
    });

    controller.queueMove(makeDrag(boxNode), { x: 1, y: 1 }, [boxNode]);
    controller.flushMove(false);
    controller.clearLastMove();
    controller.flushMove(true);

    expect(applyStructuredScene).not.toHaveBeenCalled();
  });
});
