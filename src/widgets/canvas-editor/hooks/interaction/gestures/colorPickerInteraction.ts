import type { GridCell, Point } from "@/shared/types";
import type { CanvasColorPickerTarget } from "@/domains/canvas/public";

type RefCell<T> = { current: T };

type CanvasColorPickApplication = {
  destination: "foreground" | "background";
  applyStaticGridSelection: boolean;
  applyStructuredTextColor: boolean;
  applyStructuredSelectionPrimaryColor: boolean;
};

export type CanvasColorSourceChoice = CanvasColorPickApplication & {
  point: Point;
  foreground: string;
  background: string;
};

type CanvasColorPickDecision =
  | { type: "none" }
  | { type: "empty" }
  | ({ type: "picked"; color: string } & CanvasColorPickApplication)
  | { type: "choose-source"; choice: CanvasColorSourceChoice };

export const getCanvasCellColorCandidates = (cell: GridCell | undefined) => ({
  foreground: cell?.char.trim() && cell.color ? cell.color : null,
  background: cell?.bgColor || null,
});

export const resolveCanvasColorPickDecision = ({
  cell,
  point,
  target,
  isStructuredTextSelectionActive,
  isStructuredNodeSelectionActive = false,
  isStaticGridSelectionActive = false,
}: {
  cell: GridCell | undefined;
  point: Point;
  target: CanvasColorPickerTarget | null;
  isStructuredTextSelectionActive: boolean;
  isStructuredNodeSelectionActive?: boolean;
  isStaticGridSelectionActive?: boolean;
}): CanvasColorPickDecision => {
  if (!target) return { type: "none" };
  const candidates = getCanvasCellColorCandidates(cell);
  const destination = target.endsWith("-to-background")
    ? "background"
    : "foreground";
  const application: CanvasColorPickApplication = {
    destination,
    applyStaticGridSelection: isStaticGridSelectionActive,
    applyStructuredTextColor:
      destination === "foreground" && isStructuredTextSelectionActive,
    applyStructuredSelectionPrimaryColor:
      destination === "foreground" &&
      !isStructuredTextSelectionActive &&
      isStructuredNodeSelectionActive,
  };
  const color = candidates.foreground ?? candidates.background;

  if (!color) return { type: "empty" };
  if (
    candidates.foreground &&
    candidates.background &&
    candidates.foreground !== candidates.background
  ) {
    return {
      type: "choose-source",
      choice: {
        point,
        foreground: candidates.foreground,
        background: candidates.background,
        ...application,
      },
    };
  }
  return {
    type: "picked",
    color,
    ...application,
  };
};

export const chooseCanvasColorSource = (
  choice: CanvasColorSourceChoice,
  source: "foreground" | "background"
): CanvasColorPickDecision => ({
  type: "picked",
  color: choice[source],
  destination: choice.destination,
  applyStaticGridSelection: choice.applyStaticGridSelection,
  applyStructuredTextColor: choice.applyStructuredTextColor,
  applyStructuredSelectionPrimaryColor:
    choice.applyStructuredSelectionPrimaryColor,
});

export type CanvasColorPickExecutor = {
  setBrushColor: (color: string) => void;
  setBrushBackgroundColor: (color: string) => void;
  setSelectionForegroundColor: (color: string) => void;
  setSelectionBackgroundColor: (color: string) => void;
  setStructuredTextColor: (color: string) => void;
  setStructuredSelectionPrimaryColor: (color: string) => void;
  openColorSourceChooser: (choice: CanvasColorSourceChoice) => void;
  clearColorPickerTarget: () => void;
  clearHoveredGrid: () => void;
};

export const executeCanvasColorPickDecision = (
  decision: CanvasColorPickDecision,
  executor: CanvasColorPickExecutor
): boolean => {
  if (decision.type === "none") return false;

  if (decision.type === "empty") return true;

  if (decision.type === "choose-source") {
    executor.openColorSourceChooser(decision.choice);
  }

  if (decision.type === "picked") {
    if (decision.destination === "background") {
      executor.setBrushBackgroundColor(decision.color);
      if (decision.applyStaticGridSelection) {
        executor.setSelectionBackgroundColor(decision.color);
      }
    } else {
      executor.setBrushColor(decision.color);
      if (decision.applyStaticGridSelection) {
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
  openColorSourceChooser,
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
  openColorSourceChooser: (choice: CanvasColorSourceChoice) => void;
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
  openColorSourceChooser,
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
  if (decision.type === "empty") {
    executor.setCursor("crosshair");
  } else {
    executor.resetDragState();
    executor.setCursor("");
  }
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
  isStaticGridSelectionActive = false,
  getCell,
  executor,
}: {
  target: CanvasColorPickerTarget | null;
  isStructuredTextSelectionActive: boolean;
  isStructuredNodeSelectionActive?: boolean;
  isStaticGridSelectionActive?: boolean;
  getCell: (point: { x: number; y: number }) => GridCell | undefined;
  executor: ColorPickerDragStartExecutor;
}): ColorPickerDragStartHandler => ({ point, preventDefault }) => {
  if (!point) return false;
  return executeColorPickerDragStart(
    resolveCanvasColorPickDecision({
      cell: getCell(point),
      point,
      target,
      isStructuredTextSelectionActive,
      isStructuredNodeSelectionActive,
      isStaticGridSelectionActive,
    }),
    {
      ...executor,
      preventDefault,
    }
  );
};
