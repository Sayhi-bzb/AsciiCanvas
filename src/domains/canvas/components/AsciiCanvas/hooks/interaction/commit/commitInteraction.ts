import type { CanvasMode, ToolType } from "@/shared/types";
import type { LegacyInteractionMode } from "../core/interactionMachine";

export type DragEndCommitDecision =
  | { type: "none" }
  | { type: "commitScratch" }
  | { type: "forceHistorySave" }
  | { type: "commitStructuredShape" }
  | { type: "flushStructuredMove" }
  | { type: "flushStructuredSplitBoxResize" };

const isStructuredShapeTool = (tool: ToolType, canvasMode: CanvasMode) =>
  canvasMode === "structured" &&
  (tool === "box" || tool === "splitBox" || tool === "line" || tool === "bg");

export const resolveDragEndCommitDecision = ({
  mode,
  tool,
  canvasMode,
  hasDragStart,
  isStructuredSplitBoxDividerResize,
}: {
  mode: LegacyInteractionMode;
  tool: ToolType;
  canvasMode: CanvasMode;
  hasDragStart: boolean;
  isStructuredSplitBoxDividerResize: boolean;
}): DragEndCommitDecision => {
  switch (mode) {
    case "drawing":
      if (tool === "brush") return { type: "commitScratch" };
      if (tool === "eraser") return { type: "forceHistorySave" };
      return { type: "none" };
    case "shape-preview":
      if (!hasDragStart) return { type: "none" };
      return isStructuredShapeTool(tool, canvasMode)
        ? { type: "commitStructuredShape" }
        : { type: "commitScratch" };
    case "structured-node-moving":
      return { type: "flushStructuredMove" };
    case "structured-box-resizing":
    case "structured-line-resizing":
      return { type: "forceHistorySave" };
    case "structured-splitbox-resizing":
      return isStructuredSplitBoxDividerResize
        ? { type: "flushStructuredSplitBoxResize" }
        : { type: "forceHistorySave" };
    default:
      return { type: "none" };
  }
};
