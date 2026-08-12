import type { Point } from "@/shared/types";
import type { CanvasMode } from "@/domains/sessions/public";
import type { ToolType } from "@/domains/canvas/public";
import type { CanvasLinkHit } from "../core/linkHitTesting";
import type { CanvasInteractionState } from "@/domains/editor/public";

export type CanvasClickDecision =
  | { type: "consume-color-picker-click" }
  | { type: "structured-text-caret"; point: Point }
  | { type: "open-link"; hit: CanvasLinkHit }
  | { type: "none" };

export const resolveCanvasClickDecision = ({
  colorPickerClickPending,
  interactionMode,
  canvasMode,
  tool,
  point,
  linkHit,
  shouldOpenLink,
}: {
  colorPickerClickPending: boolean;
  interactionMode: CanvasInteractionState["type"];
  canvasMode: CanvasMode;
  tool: ToolType;
  point: Point | null;
  linkHit: CanvasLinkHit | null;
  shouldOpenLink: boolean;
}): CanvasClickDecision => {
  if (colorPickerClickPending) return { type: "consume-color-picker-click" };
  if (interactionMode !== "idle") return { type: "none" };

  if (canvasMode === "structured" && tool === "text") {
    return point ? { type: "structured-text-caret", point } : { type: "none" };
  }

  return linkHit && shouldOpenLink
    ? { type: "open-link", hit: linkHit }
    : { type: "none" };
};

