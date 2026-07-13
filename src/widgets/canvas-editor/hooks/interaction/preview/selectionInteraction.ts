import type { SelectionArea } from "@/shared/types";
import type { CanvasMode } from "@/domains/sessions/public";
import type { ToolType } from "@/domains/canvas/public";
import type { StructuredNode } from "@/domains/structured-content/public";
import {
  findStructuredNodeIdsInSelection,
} from "@/domains/structured-content/public";

export type SelectionCommitDecision =
  | { type: "none" }
  | { type: "fill"; selection: SelectionArea }
  | { type: "setTextCursor"; point: SelectionArea["start"] }
  | { type: "addSelection"; selection: SelectionArea }
  | { type: "setStructuredSelection"; ids: string[] }
  | { type: "setStructuredGridFocus"; point: SelectionArea["start"] };

const isSingleCellSelection = (selection: SelectionArea) =>
  selection.start.x === selection.end.x && selection.start.y === selection.end.y;

export const resolveSelectionCommitDecision = ({
  selection,
  tool,
  canvasMode,
  structuredScene,
}: {
  selection: SelectionArea | null;
  tool: ToolType;
  canvasMode: CanvasMode;
  structuredScene: StructuredNode[];
}): SelectionCommitDecision => {
  if (!selection) return { type: "none" };
  if (tool === "fill") return { type: "fill", selection };
  if (tool !== "select") return { type: "none" };

  if (canvasMode === "structured") {
    const ids = findStructuredNodeIdsInSelection(structuredScene, selection);
    return ids.length > 0
      ? { type: "setStructuredSelection", ids }
      : { type: "setStructuredGridFocus", point: selection.start };
  }

  return isSingleCellSelection(selection)
    ? { type: "setTextCursor", point: selection.start }
    : { type: "addSelection", selection };
};
