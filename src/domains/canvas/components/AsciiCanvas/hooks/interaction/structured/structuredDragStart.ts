import type { GridMap, Point, StructuredNode } from "@/shared/types";
import { sceneToGridEntries } from "@/shared/utils/structured";
import { createMapFromEntries } from "@/domains/canvas/state/helpers/snapshotHelpers";
import {
  isStructuredSplitBoxLineHandle,
  type StructuredBoxResizeHandle,
  type StructuredLineResizeHandle,
  type StructuredNodeHit,
  type StructuredSplitBoxHandle,
} from "@/domains/canvas/state/helpers/structuredBoxEditing";
import type { InteractionEvent } from "../core/interactionMachine";

export type StructuredNodeDragPayload = {
  node: StructuredNode;
  selectedIds: string[];
  selectedNodes: StructuredNode[];
  baseScene: StructuredNode[];
  baseGrid: GridMap;
  handle:
    | StructuredBoxResizeHandle
    | StructuredSplitBoxHandle
    | StructuredLineResizeHandle
    | null;
};

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
    baseGrid: createMapFromEntries(sceneToGridEntries(baseScene)),
    handle: hit.handle,
  };

  let interactionEvent: InteractionEvent;
  if (isSplitDividerResize) {
    interactionEvent = {
      type: "startStructuredResizing",
      kind: "splitBoxPending",
      nodeId: hit.node.id,
      handle: hit.handle!,
    };
  } else if (isSplitBoxResize) {
    interactionEvent = {
      type: "startStructuredResizing",
      kind: "splitBox",
      nodeId: hit.node.id,
      handle: hit.handle!,
    };
  } else if (isRectResize) {
    interactionEvent = {
      type: "startStructuredResizing",
      kind: "rect",
      nodeId: hit.node.id,
      handle: hit.handle!,
    };
  } else if (isLineResize) {
    interactionEvent = {
      type: "startStructuredResizing",
      kind: "line",
      nodeId: hit.node.id,
      handle: hit.handle!,
    };
  } else {
    interactionEvent = {
      type: "startStructuredMoving",
      ids: selectedIds,
      anchor: start,
      baseScene,
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
