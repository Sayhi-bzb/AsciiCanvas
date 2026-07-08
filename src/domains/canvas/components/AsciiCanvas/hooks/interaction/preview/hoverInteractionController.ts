import type { Point } from "@/shared/types";
import type { CanvasLinkHit } from "../core/linkHitTesting";
import { shouldUseCanvasLinkPointer } from "../core/hitTesting";

export type HoverInteractionController = {
  updateLinkHover: (
    hit: CanvasLinkHit | null,
    event: Pick<MouseEvent | KeyboardEvent, "ctrlKey" | "metaKey">
  ) => void;
  syncLinkModifierState: (
    event: Pick<MouseEvent | KeyboardEvent, "ctrlKey" | "metaKey">
  ) => void;
  clearLinkHover: (
    event?: Pick<MouseEvent | KeyboardEvent, "ctrlKey" | "metaKey">
  ) => void;
  updateColorPickerHover: (point: Point | null) => void;
  setCursor: (cursor: string) => void;
  getLinkCandidate: () => CanvasLinkHit | null;
};

export const createHoverInteractionController = ({
  getContainer,
  setHoveredLink,
  setHoveredGrid,
}: {
  getContainer: () => HTMLDivElement | null;
  setHoveredLink: (hit: CanvasLinkHit | null) => void;
  setHoveredGrid: (point: Point | null) => void;
}): HoverInteractionController => {
  let linkCandidate: CanvasLinkHit | null = null;

  const setCursor = (cursor: string) => {
    const container = getContainer();
    if (container) container.style.cursor = cursor;
  };

  const updateLinkHover: HoverInteractionController["updateLinkHover"] = (
    hit,
    event
  ) => {
    linkCandidate = hit;
    setHoveredLink(hit);
    setCursor(shouldUseCanvasLinkPointer(hit, event) ? "pointer" : "");
  };

  const syncLinkModifierState: HoverInteractionController["syncLinkModifierState"] =
    (event) => {
      setCursor(
        shouldUseCanvasLinkPointer(linkCandidate, event) ? "pointer" : ""
      );
    };

  const clearLinkHover: HoverInteractionController["clearLinkHover"] = (
    event = { ctrlKey: false, metaKey: false }
  ) => {
    updateLinkHover(null, event);
  };

  const updateColorPickerHover = (point: Point | null) => {
    setHoveredGrid(point);
    setCursor("crosshair");
  };

  return {
    updateLinkHover,
    syncLinkModifierState,
    clearLinkHover,
    updateColorPickerHover,
    setCursor,
    getLinkCandidate: () => linkCandidate,
  };
};


