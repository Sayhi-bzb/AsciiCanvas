import type { GridCell } from "@/shared/types";
import type { CanvasColorPickerTarget } from "@/domains/canvas/public";

type RefCell<T> = { current: T };

export type CanvasColorPickDecision =
  | { type: "none" }
  | {
      type: "picked";
      color: string;
      applyStructuredTextColor: boolean;
    }
  | { type: "clear-target" };

export const getCanvasCellPickedColor = (
  cell: GridCell | undefined,
  target: CanvasColorPickerTarget | null
): string | null => {
  if (!cell || !target) return null;
  if (target === "bg") return cell.bgColor ?? null;
  return cell.char.trim() ? cell.color : null;
};

export const resolveCanvasColorPickDecision = ({
  cell,
  target,
  isStructuredTextSelectionActive,
}: {
  cell: GridCell | undefined;
  target: CanvasColorPickerTarget | null;
  isStructuredTextSelectionActive: boolean;
}): CanvasColorPickDecision => {
  if (!target) return { type: "none" };
  const color = getCanvasCellPickedColor(cell, target);
  if (!color) return { type: "clear-target" };
  return {
    type: "picked",
    color,
    applyStructuredTextColor:
      target === "char" && isStructuredTextSelectionActive,
  };
};

export type CanvasColorPickExecutor = {
  setBrushColor: (color: string) => void;
  setStructuredTextColor: (color: string) => void;
  clearColorPickerTarget: () => void;
  clearHoveredGrid: () => void;
};

export const executeCanvasColorPickDecision = (
  decision: CanvasColorPickDecision,
  executor: CanvasColorPickExecutor
): boolean => {
  if (decision.type === "none") return false;

  if (decision.type === "picked") {
    executor.setBrushColor(decision.color);
    if (decision.applyStructuredTextColor) {
      executor.setStructuredTextColor(decision.color);
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
  setStructuredTextColor,
  clearColorPickerTarget,
  clearHoveredGrid,
  resetDragState,
  setCursor,
}: {
  colorPickerClick: RefCell<boolean>;
  preventDefault: () => void;
  setBrushColor: (color: string) => void;
  setStructuredTextColor: (color: string) => void;
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
  setStructuredTextColor,
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

export type ColorPickerDragStartHandler = ({
  point,
  preventDefault,
}: {
  point: { x: number; y: number } | null;
  preventDefault: () => void;
}) => boolean;

export const createColorPickerDragStartHandler = ({
  target,
  isStructuredTextSelectionActive,
  getCell,
  executor,
}: {
  target: CanvasColorPickerTarget | null;
  isStructuredTextSelectionActive: boolean;
  getCell: (point: { x: number; y: number }) => GridCell | undefined;
  executor: ColorPickerDragStartExecutor;
}): ColorPickerDragStartHandler => ({ point, preventDefault }) => {
  if (!point) return false;
  return executeColorPickerDragStart(
    resolveCanvasColorPickDecision({
      cell: getCell(point),
      target,
      isStructuredTextSelectionActive,
    }),
    {
      ...executor,
      preventDefault,
    }
  );
};
