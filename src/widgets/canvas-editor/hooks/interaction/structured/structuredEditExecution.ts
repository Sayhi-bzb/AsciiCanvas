import type { Point, SelectionArea } from "@/shared/types";
import type { CanvasMode } from "@/domains/sessions/public";
import type { ToolType } from "@/domains/canvas/public";
import type { StructuredNode } from "@/domains/structured-content/public";
import type { StructuredTextSelection } from "@/domains/structured-content/public";
import {
  resolveStructuredEditAttempt,
  type StructuredEditDecision,
} from "./structuredEditDecision";

export type StructuredEditExecutor = {
  setSelectedStructuredNodeIds: (ids: string[]) => void;
  setSelectedStructuredSplitHandle: (handle: null) => void;
  clearSelections: () => void;
  setTextCursor: (point: Point) => void;
  setEditingStructuredTextNodeId: (nodeId: string | null) => void;
  setStructuredTextSelection: (
    selection: StructuredTextSelection | null
  ) => void;
  setSelectionPreview: (selection: SelectionArea | null) => void;
  resetDragState: () => void;
  setCursor: (cursor: string) => void;
};

export type StructuredEditController = {
  startEdit: (clientX: number, clientY: number) => boolean;
};

export const executeStructuredEditDecision = (
  decision: StructuredEditDecision,
  executor: StructuredEditExecutor
): boolean => {
  if (decision.type === "none") return false;

  executor.setSelectedStructuredNodeIds([decision.nodeId]);
  executor.setSelectedStructuredSplitHandle(null);
  executor.clearSelections();
  executor.setTextCursor(decision.cursor);
  executor.setEditingStructuredTextNodeId(
    decision.type === "text" ? decision.nodeId : null
  );
  executor.setStructuredTextSelection(null);
  executor.setSelectionPreview(null);
  executor.resetDragState();
  executor.setCursor("text");
  return true;
};

export const createStructuredEditController = ({
  getCanvasMode,
  getTool,
  resolvePoint,
  getStructuredScene,
  getSelectedStructuredNodeIds,
  getEditingStructuredTextNodeId,
  executor,
}: {
  getCanvasMode: () => CanvasMode;
  getTool: () => ToolType;
  resolvePoint: (clientX: number, clientY: number) => Point | null;
  getStructuredScene: () => StructuredNode[];
  getSelectedStructuredNodeIds: () => string[];
  getEditingStructuredTextNodeId: () => string | null;
  executor: StructuredEditExecutor;
}): StructuredEditController => ({
  startEdit: (clientX, clientY) =>
    executeStructuredEditDecision(
      resolveStructuredEditAttempt({
        canvasMode: getCanvasMode(),
        tool: getTool(),
        point: resolvePoint(clientX, clientY),
        structuredScene: getStructuredScene(),
        selectedStructuredNodeIds: getSelectedStructuredNodeIds(),
        editingStructuredTextNodeId: getEditingStructuredTextNodeId(),
      }),
      executor
    ),
});
export type StructuredEditRouteHandler = ({
  clientPoint,
  shouldIgnore,
  preventDefault,
}: {
  clientPoint: Point;
  shouldIgnore: () => boolean;
  preventDefault: () => void;
}) => boolean;

export const createStructuredEditRouteHandler = ({
  controller,
}: {
  controller: StructuredEditController;
}): StructuredEditRouteHandler =>
  ({ clientPoint, shouldIgnore, preventDefault }) => {
    if (shouldIgnore()) return false;
    if (!controller.startEdit(clientPoint.x, clientPoint.y)) return false;
    preventDefault();
    return true;
  };
