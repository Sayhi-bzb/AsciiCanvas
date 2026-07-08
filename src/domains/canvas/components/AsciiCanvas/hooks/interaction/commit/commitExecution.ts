import type { Point, SelectionArea, ToolType } from "@/shared/types";
import type { DragEndCommitDecision } from "./commitInteraction";
import type { SelectionCommitDecision } from "../preview/selectionInteraction";

export type SelectionCommitExecutor = {
  fillArea: (selection: SelectionArea) => void;
  setSelectedStructuredNodeIds: (ids: string[]) => void;
  setSelectedStructuredSplitHandle: (handle: null) => void;
  setStructuredGridFocus: (point: Point) => void;
  setTextCursor: (point: Point) => void;
  addSelection: (selection: SelectionArea) => void;
  clearSelections: () => void;
  clearSelectionPreview: () => void;
};

export type DragEndCommitExecutor = {
  commitScratch: () => void;
  forceHistorySave: () => void;
  commitStructuredShape: (
    tool: Extract<ToolType, "box" | "splitBox" | "line" | "bg">,
    start: Point,
    end: Point,
    options: { axis: "horizontal" | "vertical" | null }
  ) => void;
  flushStructuredMove: () => void;
  flushStructuredSplitBoxResize: () => void;
};

const isStructuredShapeTool = (
  tool: ToolType
): tool is Extract<ToolType, "box" | "splitBox" | "line" | "bg"> =>
  tool === "box" || tool === "splitBox" || tool === "line" || tool === "bg";

export const executeSelectionCommitDecision = (
  decision: SelectionCommitDecision,
  executor: SelectionCommitExecutor
): void => {
  switch (decision.type) {
    case "fill":
      executor.fillArea(decision.selection);
      break;
    case "setStructuredSelection":
      executor.setSelectedStructuredNodeIds(decision.ids);
      executor.setSelectedStructuredSplitHandle(null);
      executor.clearSelections();
      break;
    case "setStructuredGridFocus":
      executor.setStructuredGridFocus(decision.point);
      executor.clearSelections();
      break;
    case "setTextCursor":
      executor.setTextCursor(decision.point);
      break;
    case "addSelection":
      executor.addSelection(decision.selection);
      break;
    case "none":
      break;
  }

  if (decision.type !== "none") {
    executor.clearSelectionPreview();
  }
};

export const executeDragEndCommitDecision = (
  decision: DragEndCommitDecision,
  executor: DragEndCommitExecutor,
  context: {
    tool: ToolType;
    startGrid: Point | null;
    endGrid: Point;
    axis: "horizontal" | "vertical" | null;
  }
): void => {
  switch (decision.type) {
    case "commitScratch":
      executor.commitScratch();
      break;
    case "forceHistorySave":
      executor.forceHistorySave();
      break;
    case "commitStructuredShape":
      if (!context.startGrid || !isStructuredShapeTool(context.tool)) break;
      executor.commitStructuredShape(context.tool, context.startGrid, context.endGrid, {
        axis: context.axis,
      });
      break;
    case "flushStructuredMove":
      executor.flushStructuredMove();
      break;
    case "flushStructuredSplitBoxResize":
      executor.flushStructuredSplitBoxResize();
      break;
    case "none":
      break;
  }
};
