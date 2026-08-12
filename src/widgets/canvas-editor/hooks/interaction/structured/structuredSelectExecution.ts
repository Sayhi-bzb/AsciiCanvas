import type { Point, SelectionArea } from "@/shared/types";
import type { StructuredNode } from "@/domains/structured-content/public";
import type { StructuredTextSelection } from "@/domains/structured-content/public";
import type {
  StructuredSplitBoxHandle,
} from "@/domains/structured-content/public";
import type { CanvasInteractionState } from "@/domains/editor/public";
import {
  resolveStructuredTextCaretSelectionStart,
} from "./structuredTextSelectionStart";
import {
  resolveStructuredSelectStartContext,
  type StructuredSelectStartDecision,
} from "./structuredSelectStart";

export type StructuredSelectStartExecutor = {
  setSelectedStructuredNodeIds: (ids: string[]) => void;
  setSelectedStructuredSplitHandle: (
    handle: { nodeId: string; handle: StructuredSplitBoxHandle } | null
  ) => void;
  setStructuredContextPoint: (point: Point | null) => void;
  setEditingStructuredTextNodeId: (nodeId: string | null) => void;
  setStructuredTextSelection: (
    selection: StructuredTextSelection | null
  ) => void;
  setTextCursor: (point: Point | null) => void;
  clearSelections: () => void;
  setSelectionPreview: (selection: SelectionArea | null) => void;
  resetDragState: () => void;
  setCursor: (cursor: string) => void;
  setInteractionState: (state: CanvasInteractionState) => void;
};

export const executeStructuredSelectStartDecision = (
  decision: StructuredSelectStartDecision,
  start: Point,
  executor: StructuredSelectStartExecutor
): boolean => {
  switch (decision.type) {
    case "double-click-text":
      executor.setSelectedStructuredNodeIds([decision.nodeId]);
      executor.setSelectedStructuredSplitHandle(null);
      executor.clearSelections();
      executor.setSelectionPreview(null);
      executor.resetDragState();
      executor.setCursor("text");
      return true;
    case "text-caret-selection": {
      const selection = resolveStructuredTextCaretSelectionStart({
        node: decision.node,
        point: start,
        caretHit: decision.caretHit,
      });
      executor.setSelectedStructuredNodeIds(selection.selectedIds);
      executor.setSelectedStructuredSplitHandle(null);
      executor.clearSelections();
      executor.setTextCursor(selection.cursor);
      executor.setStructuredTextSelection(selection.textSelection);
      executor.setInteractionState(selection.state);
      executor.setSelectionPreview(null);
      executor.setCursor("text");
      return true;
    }
    case "node-drag": {
      const drag = decision.dragStart;
      executor.setSelectedStructuredNodeIds(drag.selectedIds);
      executor.setStructuredContextPoint(drag.contextPoint);
      executor.setSelectedStructuredSplitHandle(drag.splitHandle);
      executor.setEditingStructuredTextNodeId(null);
      executor.setStructuredTextSelection(null);
      executor.setInteractionState(drag.state);
      executor.setCursor(decision.cursor);
      executor.setTextCursor(null);
      executor.clearSelections();
      return true;
    }
    case "clear-empty":
      executor.setSelectedStructuredNodeIds([]);
      executor.setSelectedStructuredSplitHandle(null);
      executor.setStructuredContextPoint(null);
      executor.setEditingStructuredTextNodeId(null);
      executor.setStructuredTextSelection(null);
      executor.setCursor("");
      return false;
    case "none":
      return false;
  }
};

export const createStructuredSelectStartExecutor = ({
  setSelectedStructuredNodeIds,
  setSelectedStructuredSplitHandle,
  setStructuredContextPoint,
  setEditingStructuredTextNodeId,
  setStructuredTextSelection,
  setTextCursor,
  clearSelections,
  setSelectionPreview,
  resetDragState,
  setCursor,
  setInteractionState,
}: {
  setSelectedStructuredNodeIds: (ids: string[]) => void;
  setSelectedStructuredSplitHandle: (
    handle: { nodeId: string; handle: StructuredSplitBoxHandle } | null
  ) => void;
  setStructuredContextPoint: (point: Point | null) => void;
  setEditingStructuredTextNodeId: (nodeId: string | null) => void;
  setStructuredTextSelection: (
    selection: StructuredTextSelection | null
  ) => void;
  setTextCursor: (point: Point | null) => void;
  clearSelections: () => void;
  setSelectionPreview: (selection: SelectionArea | null) => void;
  resetDragState: () => void;
  setCursor: (cursor: string) => void;
  setInteractionState: (state: CanvasInteractionState) => void;
}): StructuredSelectStartExecutor => ({
  setSelectedStructuredNodeIds,
  setSelectedStructuredSplitHandle,
  setStructuredContextPoint,
  setEditingStructuredTextNodeId,
  setStructuredTextSelection,
  setTextCursor,
  clearSelections,
  setSelectionPreview,
  resetDragState,
  setCursor,
  setInteractionState,
});

type StructuredSelectStartHandler = ({
  screenPoint,
  start,
  mouseDetail,
}: {
  screenPoint: Point | null;
  start: Point;
  mouseDetail: number;
}) => boolean;

export const createStructuredSelectStartHandler = ({
  selectedStructuredNodeIds,
  structuredScene,
  offset,
  zoom,
  editingStructuredTextNodeId,
  executor,
}: {
  selectedStructuredNodeIds: string[];
  structuredScene: StructuredNode[];
  offset: Point;
  zoom: number;
  editingStructuredTextNodeId: string | null;
  executor: StructuredSelectStartExecutor;
}): StructuredSelectStartHandler => ({ screenPoint, start, mouseDetail }) => {
  const startContext = resolveStructuredSelectStartContext({
    screenPoint,
    start,
    selectedStructuredNodeIds,
    structuredScene,
    offset,
    zoom,
    editingStructuredTextNodeId,
    mouseDetail,
  });

  return executeStructuredSelectStartDecision(
    startContext.decision,
    start,
    executor
  );
};
