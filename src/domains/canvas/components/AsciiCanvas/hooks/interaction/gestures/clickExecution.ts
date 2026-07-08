import type { CanvasMode, Point, ToolType } from "@/shared/types";
import type { CanvasLinkHit } from "../core/linkHitTesting";
import type { LegacyInteractionMode } from "../core/interactionMachine";
import { resolveCanvasClickDecision, type CanvasClickDecision } from "./clickInteraction";

type RefCell<T> = { current: T };

export type CanvasClickExecutor = {
  preventDefault: () => void;
  clearColorPickerClick: () => void;
  clearSelections: () => void;
  setSelectedStructuredNodeIds: (ids: string[]) => void;
  setSelectedStructuredSplitHandle: (handle: null) => void;
  setEditingStructuredTextNodeId: (nodeId: string | null) => void;
  setTextCursor: (point: Point) => void;
  setCursor: (cursor: string) => void;
  openLink: (href: string) => void;
  setHoveredLink: (hit: CanvasLinkHit) => void;
};

export const executeCanvasClickDecision = (
  decision: CanvasClickDecision,
  executor: CanvasClickExecutor
): boolean => {
  switch (decision.type) {
    case "consume-color-picker-click":
      executor.clearColorPickerClick();
      executor.preventDefault();
      return true;
    case "structured-text-caret":
      executor.preventDefault();
      executor.clearSelections();
      executor.setSelectedStructuredNodeIds([]);
      executor.setSelectedStructuredSplitHandle(null);
      executor.setEditingStructuredTextNodeId(null);
      executor.setTextCursor(decision.point);
      executor.setCursor("text");
      return true;
    case "open-link":
      executor.preventDefault();
      executor.openLink(decision.hit.href);
      executor.setHoveredLink(decision.hit);
      return true;
    case "none":
      return false;
  }
};



export const createCanvasClickExecutor = ({
  colorPickerClick,
  preventDefault,
  clearSelections,
  setSelectedStructuredNodeIds,
  setSelectedStructuredSplitHandle,
  setEditingStructuredTextNodeId,
  setTextCursor,
  setCursor,
  openLink,
  setHoveredLink,
}: {
  colorPickerClick: RefCell<boolean>;
  preventDefault: () => void;
  clearSelections: () => void;
  setSelectedStructuredNodeIds: (ids: string[]) => void;
  setSelectedStructuredSplitHandle: (handle: null) => void;
  setEditingStructuredTextNodeId: (nodeId: string | null) => void;
  setTextCursor: (point: Point) => void;
  setCursor: (cursor: string) => void;
  openLink: (href: string) => void;
  setHoveredLink: (hit: CanvasLinkHit) => void;
}): CanvasClickExecutor => ({
  preventDefault,
  clearColorPickerClick: () => {
    colorPickerClick.current = false;
  },
  clearSelections,
  setSelectedStructuredNodeIds,
  setSelectedStructuredSplitHandle,
  setEditingStructuredTextNodeId,
  setTextCursor,
  setCursor,
  openLink,
  setHoveredLink,
});

export type CanvasClickHandler = ({
  point,
  linkHit,
  shouldOpenLink,
  preventDefault,
}: {
  point: Point | null;
  linkHit: CanvasLinkHit | null;
  shouldOpenLink: boolean;
  preventDefault: () => void;
}) => boolean;

export const createCanvasClickHandler = ({
  getColorPickerClickPending,
  getInteractionMode,
  canvasMode,
  tool,
  executor,
}: {
  getColorPickerClickPending: () => boolean;
  getInteractionMode: () => LegacyInteractionMode;
  canvasMode: CanvasMode;
  tool: ToolType;
  executor: CanvasClickExecutor;
}): CanvasClickHandler => ({
  point,
  linkHit,
  shouldOpenLink,
  preventDefault,
}) =>
  executeCanvasClickDecision(
    resolveCanvasClickDecision({
      colorPickerClickPending: getColorPickerClickPending(),
      interactionMode: getInteractionMode(),
      canvasMode,
      tool,
      point,
      linkHit,
      shouldOpenLink,
    }),
    {
      ...executor,
      preventDefault,
    }
  );
