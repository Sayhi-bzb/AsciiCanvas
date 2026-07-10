import { describe, expect, it } from "vitest";
import {
  INITIAL_INTERACTION_STATE,
  toLegacyInteractionMode,
  transitionInteractionState,
} from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/core/interactionMachine";
import type { StructuredBoxNode } from "@/shared/types";

const boxNode: StructuredBoxNode = {
  id: "box-1",
  type: "box",
  order: 1,
  start: { x: 0, y: 0 },
  end: { x: 4, y: 2 },
  style: { color: "#ffffff" },
};

describe("canvas interaction machine", () => {
  it("starts and resets panning", () => {
    const panning = transitionInteractionState(INITIAL_INTERACTION_STATE, {
      type: "startPanning",
      lastScreen: { x: 12, y: 24 },
    });

    expect(panning).toEqual({
      type: "panning",
      lastScreen: { x: 12, y: 24 },
    });
    expect(transitionInteractionState(panning, { type: "reset" })).toBe(
      INITIAL_INTERACTION_STATE
    );
  });

  it("updates selection only while selecting", () => {
    const selecting = transitionInteractionState(INITIAL_INTERACTION_STATE, {
      type: "startSelecting",
      anchor: { x: 1, y: 2 },
    });

    expect(
      transitionInteractionState(selecting, {
        type: "updateSelection",
        current: { x: 5, y: 6 },
      })
    ).toEqual({
      type: "selecting",
      anchor: { x: 1, y: 2 },
      current: { x: 5, y: 6 },
    });

    expect(
      transitionInteractionState(INITIAL_INTERACTION_STATE, {
        type: "updateSelection",
        current: { x: 5, y: 6 },
      })
    ).toBe(INITIAL_INTERACTION_STATE);
  });

  it("tracks shape preview axis", () => {
    const preview = transitionInteractionState(INITIAL_INTERACTION_STATE, {
      type: "startShapePreview",
      tool: "line",
      start: { x: 0, y: 0 },
    });

    expect(
      transitionInteractionState(preview, {
        type: "setShapePreviewAxis",
        axis: "vertical",
      })
    ).toMatchObject({ type: "shapePreview", axis: "vertical" });
  });

  it("creates structured move and resize states", () => {
    expect(
      transitionInteractionState(INITIAL_INTERACTION_STATE, {
        type: "startStructuredMoving",
        ids: [boxNode.id],
        anchor: { x: 1, y: 1 },
        baseScene: [boxNode],
      })
    ).toMatchObject({
      type: "structuredMoving",
      ids: [boxNode.id],
      anchor: { x: 1, y: 1 },
    });

    expect(
      transitionInteractionState(INITIAL_INTERACTION_STATE, {
        type: "startStructuredResizing",
        kind: "rect",
        nodeId: boxNode.id,
        handle: "se",
      })
    ).toEqual({
      type: "structuredRectResizing",
      nodeId: boxNode.id,
      handle: "se",
    });

    expect(
      transitionInteractionState(INITIAL_INTERACTION_STATE, {
        type: "startStructuredResizing",
        kind: "splitBox",
        nodeId: "split-1",
        handle: "split:split-middle",
      })
    ).toEqual({
      type: "structuredSplitBoxResizing",
      nodeId: "split-1",
      handle: "split:split-middle",
    });
  });


  it("maps typed states to legacy modes while the hook is migrating", () => {
    const pending = transitionInteractionState(INITIAL_INTERACTION_STATE, {
      type: "startStructuredResizing",
      kind: "splitBoxPending",
      nodeId: "split-1",
      handle: "split:split-middle",
    });

    expect(pending).toEqual({
      type: "structuredSplitBoxResizePending",
      nodeId: "split-1",
      handle: "split:split-middle",
    });
    expect(toLegacyInteractionMode(pending)).toBe(
      "structured-splitbox-resize-pending"
    );
  });
  it("starts structured text selection", () => {
    expect(
      transitionInteractionState(INITIAL_INTERACTION_STATE, {
        type: "startStructuredTextSelecting",
        nodeId: "text-1",
        anchorOffset: 3,
      })
    ).toEqual({
      type: "structuredTextSelecting",
      nodeId: "text-1",
      anchorOffset: 3,
    });
  });
});
