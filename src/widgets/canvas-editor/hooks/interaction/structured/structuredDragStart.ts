import type { Point } from "@/shared/types";
import type { StructuredNode } from "@/domains/structured-content/public";
import { sceneToGridEntries } from "@/domains/structured-content/public";
import { createGridMap } from "@/shared/utils/grid-codec";
import {
  isStructuredSplitBoxLineHandle,
  type StructuredNodeHit,
  type StructuredSplitBoxHandle,
} from "@/domains/structured-content/public";
import type {
  InteractionEvent,
  StructuredNodeDragPayload,
} from "../core/interactionMachine";

export type { StructuredNodeDragPayload } from "../core/interactionMachine";

export type StructuredDragStartDecision = {
  selectedIds: string[];
  contextPoint: Point | null;
  splitHandle: { nodeId: string; handle: StructuredSplitBoxHandle } | null;
  drag: StructuredNodeDragPayload;
  interactionEvent: InteractionEvent;
};

export const resolveStructuredDragStartDecision = ({
  hit,
  start,
  selectedStructuredNodeIds,
  structuredScene,
}: {
  hit: StructuredNodeHit;
  start: Point;
  selectedStructuredNodeIds: string[];
  structuredScene: StructuredNode[];
}): StructuredDragStartDecision => {
  const isRectResize =
    (hit.kind === "box" || hit.kind === "bg") && !!hit.handle;
  const isSplitDividerResize =
    hit.kind === "splitBox" &&
    !!hit.handle &&
    isStructuredSplitBoxLineHandle(hit.handle);
  const isSplitBoxResize = hit.kind === "splitBox" && !!hit.handle;
  const isLineResize = hit.kind === "line" && !!hit.handle;
  const shouldMoveSelection =
    !isRectResize &&
    !isSplitBoxResize &&
    !isLineResize &&
    selectedStructuredNodeIds.includes(hit.node.id);
  const selectedIds = shouldMoveSelection
    ? [...selectedStructuredNodeIds]
    : [hit.node.id];
  const selectedIdSet = new Set(selectedIds);
  const selectedNodes = structuredScene.filter((node) =>
    selectedIdSet.has(node.id)
  );
  const baseScene = structuredScene.filter((node) => !selectedIdSet.has(node.id));
  const drag = {
    node: hit.node,
    selectedIds,
    selectedNodes: selectedNodes.length > 0 ? selectedNodes : [hit.node],
    baseScene,
    baseGrid: createGridMap(sceneToGridEntries(baseScene)),
    handle: hit.handle,
  };

  let interactionEvent: InteractionEvent;
  if (isSplitDividerResize) {
    interactionEvent = {
      type: "startStructuredResizing",
      kind: "splitBoxPending",
      anchor: start,
      drag,
    };
  } else if (isSplitBoxResize) {
    interactionEvent = {
      type: "startStructuredResizing",
      kind: "splitBox",
      anchor: start,
      drag,
    };
  } else if (isRectResize) {
    interactionEvent = {
      type: "startStructuredResizing",
      kind: "rect",
      anchor: start,
      drag,
    };
  } else if (isLineResize) {
    interactionEvent = {
      type: "startStructuredResizing",
      kind: "line",
      anchor: start,
      drag,
    };
  } else {
    interactionEvent = {
      type: "startStructuredMoving",
      anchor: start,
      drag,
    };
  }

  return {
    selectedIds,
    contextPoint: hit.kind === "splitBox" ? start : null,
    splitHandle:
      hit.kind === "splitBox" &&
      hit.handle &&
      isStructuredSplitBoxLineHandle(hit.handle)
        ? { nodeId: hit.node.id, handle: hit.handle }
        : null,
    drag,
    interactionEvent,
  };
};
