import type { GridCell } from "@/shared/types";
import type { CanvasColorPickerTarget } from "@/domains/canvas/public";

type RefCell<T> = { current: T };

type CanvasColorPickDecision =
  | { type: "none" }
  | {
      type: "picked";
      color: string;
      destination: "foreground" | "background";
      applyFreeformSelection: boolean;
      applyStructuredTextColor: boolean;
      applyStructuredSelectionPrimaryColor: boolean;
    }
  | { type: "clear-target" };

export const getCanvasCellPickedColor = (
  cell: GridCell | undefined,
  target: CanvasColorPickerTarget | null
): string | null => {
  if (!cell || !target) return null;
  if (target === "bg" || target === "bg-to-background") {
    return cell.bgColor ?? null;
  }
  return cell.char.trim() ? cell.color : null;
};

export const resolveCanvasColorPickDecision = ({
  cell,
  target,
  isStructuredTextSelectionActive,
  isStructuredNodeSelectionActive = false,
  isFreeformSelectionActive = false,
}: {
  cell: GridCell | undefined;
  target: CanvasColorPickerTarget | null;
  isStructuredTextSelectionActive: boolean;
  isStructuredNodeSelectionActive?: boolean;
  isFreeformSelectionActive?: boolean;
}): CanvasColorPickDecision => {
  if (!target) return { type: "none" };
  const color = getCanvasCellPickedColor(cell, target);
  if (!color) return { type: "clear-target" };
  const destination = target.endsWith("-to-background")
    ? "background"
    : "foreground";
  return {
    type: "picked",
    color,
    destination,
    applyFreeformSelection: isFreeformSelectionActive,
    applyStructuredTextColor:
      destination === "foreground" && isStructuredTextSelectionActive,
    applyStructuredSelectionPrimaryColor:
      destination === "foreground" &&
      !isStructuredTextSelectionActive &&
      isStructuredNodeSelectionActive,
  };
};

export type CanvasColorPickExecutor = {
  setBrushColor: (color: string) => void;
  setBrushBackgroundColor: (color: string) => void;
  setSelectionForegroundColor: (color: string) => void;
  setSelectionBackgroundColor: (color: string) => void;
  setStructuredTextColor: (color: string) => void;
  setStructuredSelectionPrimaryColor: (color: string) => void;
  clearColorPickerTarget: () => void;
  clearHoveredGrid: () => void;
};

export const executeCanvasColorPickDecision = (
  decision: CanvasColorPickDecision,
  executor: CanvasColorPickExecutor
): boolean => {
  if (decision.type === "none") return false;

  if (decision.type === "picked") {
    if (decision.destination === "background") {
      executor.setBrushBackgroundColor(decision.color);
      if (decision.applyFreeformSelection) {
        executor.setSelectionBackgroundColor(decision.color);
      }
    } else {
      executor.setBrushColor(decision.color);
      if (decision.applyFreeformSelection) {
        executor.setSelectionForegroundColor(decision.color);
      }
    }
    if (decision.applyStructuredTextColor) {
      executor.setStructuredTextColor(decision.color);
    }
    if (decision.applyStructuredSelectionPrimaryColor) {
      executor.setStructuredSelectionPrimaryColor(decision.color);
    }
  }

  executor.clearColorPickerTarget();
  executor.clearHoveredGrid();
  return true;
};

export type ColorPickerDragStartExecutor = CanvasColorPickExecutor & {
  preventDefault: () => void;
  markColorPickerClick: () => void;
  resetDragState: () => void;
  setCursor: (cursor: string) => void;
};

export const createColorPickerDragStartExecutor = ({
  colorPickerClick,
  preventDefault,
  setBrushColor,
  setBrushBackgroundColor,
  setSelectionForegroundColor,
  setSelectionBackgroundColor,
  setStructuredTextColor,
  setStructuredSelectionPrimaryColor,
  clearColorPickerTarget,
  clearHoveredGrid,
  resetDragState,
  setCursor,
}: {
  colorPickerClick: RefCell<boolean>;
  preventDefault: () => void;
  setBrushColor: (color: string) => void;
  setBrushBackgroundColor: (color: string) => void;
  setSelectionForegroundColor: (color: string) => void;
  setSelectionBackgroundColor: (color: string) => void;
  setStructuredTextColor: (color: string) => void;
  setStructuredSelectionPrimaryColor: (color: string) => void;
  clearColorPickerTarget: () => void;
  clearHoveredGrid: () => void;
  resetDragState: () => void;
  setCursor: (cursor: string) => void;
}): ColorPickerDragStartExecutor => ({
  preventDefault,
  markColorPickerClick: () => {
    colorPickerClick.current = true;
  },
  setBrushColor,
  setBrushBackgroundColor,
  setSelectionForegroundColor,
  setSelectionBackgroundColor,
  setStructuredTextColor,
  setStructuredSelectionPrimaryColor,
  clearColorPickerTarget,
  clearHoveredGrid,
  resetDragState,
  setCursor,
});

export const executeColorPickerDragStart = (
  decision: CanvasColorPickDecision,
  executor: ColorPickerDragStartExecutor
): boolean => {
  if (decision.type === "none") return false;

  executor.preventDefault();
  executor.markColorPickerClick();
  executeCanvasColorPickDecision(decision, executor);
  executor.resetDragState();
  executor.setCursor("");
  return true;
};

type ColorPickerDragStartHandler = ({
  point,
  preventDefault,
}: {
  point: { x: number; y: number } | null;
  preventDefault: () => void;
}) => boolean;

export const createColorPickerDragStartHandler = ({
  target,
  isStructuredTextSelectionActive,
  isStructuredNodeSelectionActive = false,
  isFreeformSelectionActive = false,
  getCell,
  executor,
}: {
  target: CanvasColorPickerTarget | null;
  isStructuredTextSelectionActive: boolean;
  isStructuredNodeSelectionActive?: boolean;
  isFreeformSelectionActive?: boolean;
  getCell: (point: { x: number; y: number }) => GridCell | undefined;
  executor: ColorPickerDragStartExecutor;
}): ColorPickerDragStartHandler => ({ point, preventDefault }) => {
  if (!point) return false;
  return executeColorPickerDragStart(
    resolveCanvasColorPickDecision({
      cell: getCell(point),
      target,
      isStructuredTextSelectionActive,
      isStructuredNodeSelectionActive,
      isFreeformSelectionActive,
    }),
    {
      ...executor,
      preventDefault,
    }
  );
};
