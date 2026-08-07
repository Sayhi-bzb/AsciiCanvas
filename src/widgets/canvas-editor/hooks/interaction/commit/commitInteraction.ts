import type { CanvasMode } from "@/domains/sessions/public";
import type { ToolType } from "@/domains/canvas/public";
import type { InteractionState } from "../core/interactionMachine";

export type DragEndCommitDecision =
  | { type: "none" }
  | { type: "commitScratch" }
  | { type: "forceHistorySave" }
  | { type: "commitStructuredShape" }
  | { type: "flushStructuredMove" }
  | { type: "flushStructuredSplitBoxResize" };

const isStructuredShapeTool = (tool: ToolType, canvasMode: CanvasMode) =>
  canvasMode === "structured" &&
  (tool === "box" ||
    tool === "splitBox" ||
    tool === "line" ||
    tool === "arrowLine" ||
    tool === "bg");

export const resolveDragEndCommitDecision = ({
  state,
  tool,
  canvasMode,
  isStructuredSplitBoxDividerResize,
}: {
  state: InteractionState;
  tool: ToolType;
  canvasMode: CanvasMode;
  isStructuredSplitBoxDividerResize: boolean;
}): DragEndCommitDecision => {
  switch (state.type) {
    case "drawing":
      if (state.tool === "brush") return { type: "commitScratch" };
      if (state.tool === "eraser") return { type: "forceHistorySave" };
      return { type: "none" };
    case "shapePreview":
      return isStructuredShapeTool(tool, canvasMode)
        ? { type: "commitStructuredShape" }
        : { type: "commitScratch" };
    case "structuredMoving":
      return { type: "flushStructuredMove" };
    case "structuredRectResizing":
    case "structuredLineResizing":
      return { type: "forceHistorySave" };
    case "structuredSplitBoxResizing":
      return isStructuredSplitBoxDividerResize
        ? { type: "flushStructuredSplitBoxResize" }
        : { type: "forceHistorySave" };
    default:
      return { type: "none" };
  }
};
