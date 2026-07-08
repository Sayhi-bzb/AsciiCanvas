import type { Point } from "@/shared/types";
import type { CanvasLinkHit } from "../core/linkHitTesting";
import type { CanvasMoveDecision } from "./moveInteraction";

export type CanvasMoveExecutor = {
  updateColorPickerHover: (point: Point | null) => void;
  updateLinkHover: (
    hit: CanvasLinkHit | null,
    event: Pick<MouseEvent | KeyboardEvent, "ctrlKey" | "metaKey">
  ) => void;
  setHoveredGrid: (point: Point | null) => void;
  setCursor: (cursor: string) => void;
};

export const createCanvasMoveExecutor = ({
  updateColorPickerHover,
  updateLinkHover,
  setHoveredGrid,
  setCursor,
}: CanvasMoveExecutor): CanvasMoveExecutor => ({
  updateColorPickerHover,
  updateLinkHover,
  setHoveredGrid,
  setCursor,
});

export const executeCanvasMoveDecision = (
  decision: CanvasMoveDecision,
  executor: CanvasMoveExecutor,
  event: Pick<MouseEvent | KeyboardEvent, "ctrlKey" | "metaKey">
): void => {
  if (decision.type === "color-picker-hover") {
    executor.updateColorPickerHover(decision.point);
    return;
  }

  executor.updateLinkHover(decision.linkHit, event);

  switch (decision.action.type) {
    case "structured-text-cursor":
      executor.setCursor("text");
      break;
    case "structured-shape-hover":
      executor.setHoveredGrid(decision.action.point);
      executor.setCursor("crosshair");
      break;
    case "structured-select-hover":
      executor.setCursor(decision.action.cursor);
      break;
    case "eraser-hover":
      executor.setHoveredGrid(decision.action.point);
      break;
    case "none":
      break;
  }
};
