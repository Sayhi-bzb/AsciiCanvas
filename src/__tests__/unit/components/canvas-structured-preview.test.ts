import { describe, expect, it } from "vitest";
import {
  buildStructuredMoveCommitScene,
  buildStructuredMovePreview,
  buildStructuredSplitBoxResizeCommitScene,
  buildStructuredSplitBoxResizePreview,
  createStructuredSplitBoxGrid,
} from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/structured/structuredInteractionPreview";
import { GridManager } from "@/shared/utils/grid";
import type {
  GridMap,
  StructuredBoxNode,
  StructuredSplitBoxNode,
} from "@/shared/types";

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

describe("structured interaction preview helpers", () => {
  it("builds move previews from selected nodes without changing the base scene", () => {
    const preview = buildStructuredMovePreview(
      {
        selectedNodes: [boxNode],
        baseScene: [backgroundNode],
        baseGrid,
      },
      { x: 2, y: 3 }
    );

    expect(preview.baseScene).toEqual([backgroundNode]);
    expect(preview.baseGrid).toBe(baseGrid);
    expect(preview.movingNodes).toEqual([
      {
        ...boxNode,
        start: { x: 3, y: 4 },
        end: { x: 7, y: 6 },
      },
    ]);
    expect(preview.movingGrid.size).toBeGreaterThan(0);
  });

  it("commits structured moves by replacing only moved scene nodes", () => {
    const nextScene = buildStructuredMoveCommitScene(
      [boxNode, backgroundNode],
      [boxNode],
      { x: -1, y: 2 }
    );

    expect(nextScene[0]).toMatchObject({
      id: "box-1",
      start: { x: 0, y: 3 },
      end: { x: 4, y: 5 },
    });
    expect(nextScene[1]).toBe(backgroundNode);
  });

  it("builds splitBox divider resize previews", () => {
    const preview = buildStructuredSplitBoxResizePreview(
      {
        node: splitBoxNode,
        baseScene: [backgroundNode],
        baseGrid,
        handle: "split:split-top",
      },
      { x: 2, y: 1 }
    );

    expect(preview?.baseScene).toEqual([backgroundNode]);
    expect(preview?.baseGrid).toBe(baseGrid);
    expect(preview?.movingNodes[0]).toMatchObject({
      id: splitBoxNode.id,
      type: "splitBox",
    });
    expect(
      (preview?.movingNodes[0] as StructuredSplitBoxNode).topSplitRatio
    ).not.toBe(splitBoxNode.topSplitRatio);
    expect(preview?.movingGrid.size).toBeGreaterThan(0);
  });

  it("returns null for invalid splitBox resize preview inputs", () => {
    expect(
      buildStructuredSplitBoxResizePreview(
        {
          node: boxNode,
          baseScene: [],
          baseGrid,
          handle: "split:split-top",
        },
        { x: 2, y: 1 }
      )
    ).toBeNull();
    expect(
      buildStructuredSplitBoxResizePreview(
        {
          node: splitBoxNode,
          baseScene: [],
          baseGrid,
          handle: null,
        },
        { x: 2, y: 1 }
      )
    ).toBeNull();
  });

  it("commits splitBox divider resize by replacing only the resized node", () => {
    const nextScene = buildStructuredSplitBoxResizeCommitScene(
      [backgroundNode, splitBoxNode],
      {
        node: splitBoxNode,
        baseScene: [backgroundNode],
        baseGrid,
        handle: "split:split-top",
      },
      { x: 2, y: 1 }
    );

    expect(nextScene?.[0]).toBe(backgroundNode);
    expect(nextScene?.[1]).toMatchObject({
      id: splitBoxNode.id,
      type: "splitBox",
    });
    expect((nextScene?.[1] as StructuredSplitBoxNode).topSplitRatio).not.toBe(
      splitBoxNode.topSplitRatio
    );
  });

  it("creates a renderable grid for splitBox nodes", () => {
    expect(createStructuredSplitBoxGrid(splitBoxNode).size).toBeGreaterThan(0);
  });
});
