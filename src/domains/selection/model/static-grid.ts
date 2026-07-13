import type { Point, SelectionArea } from "@/shared/types";

export type GridAddress = Point;
export type GridEditMode = "navigate" | "text-edit";

export interface GridRange {
  start: GridAddress;
  end: GridAddress;
}

export interface GridSelectionState {
  activeCell: GridAddress;
  anchorCell: GridAddress;
  ranges: GridRange[];
}

export interface StaticGridState {
  selection: GridSelectionState;
  editMode: GridEditMode;
}

export interface StaticGridViewState {
  activeCell: GridAddress;
  textCursor: GridAddress | null;
  selectionAreas: SelectionArea[];
  hasSelection: boolean;
  isTextEditing: boolean;
}

export const createGridAddress = (x = 0, y = 0): GridAddress => ({ x, y });

export const normalizeGridRange = (range: GridRange): GridRange => ({
  start: {
    x: Math.min(range.start.x, range.end.x),
    y: Math.min(range.start.y, range.end.y),
  },
  end: {
    x: Math.max(range.start.x, range.end.x),
    y: Math.max(range.start.y, range.end.y),
  },
});

export const gridRangeFromSelectionArea = (area: SelectionArea): GridRange =>
  normalizeGridRange({ start: area.start, end: area.end });

export const selectionAreaFromGridRange = (range: GridRange): SelectionArea => {
  const normalized = normalizeGridRange(range);
  return {
    start: { ...normalized.start },
    end: { ...normalized.end },
  };
};

export const gridRangesFromSelectionAreas = (areas: SelectionArea[]) =>
  areas.map(gridRangeFromSelectionArea);

export const selectionAreasFromGridRanges = (ranges: GridRange[]) =>
  ranges.map(selectionAreaFromGridRange);

export const getStaticGridSelectionAreas = (state: GridSelectionState) =>
  selectionAreasFromGridRanges(state.ranges);

export const hasStaticGridSelection = (state: GridSelectionState) =>
  state.ranges.length > 0;

export const getStaticGridViewState = (input: {
  selection: GridSelectionState;
  editMode: GridEditMode;
  textCursor: Point | null;
  selections: SelectionArea[];
}): StaticGridViewState => {
  const selectionAreas = getStaticGridSelectionAreas(input.selection);
  const activeSelectionAreas =
    selectionAreas.length > 0 ? selectionAreas : input.selections;
  const activeCell = input.textCursor
    ? { ...input.textCursor }
    : { ...input.selection.activeCell };
  const isTextEditing = input.editMode === "text-edit";

  return {
    activeCell,
    textCursor: input.textCursor || isTextEditing ? activeCell : null,
    selectionAreas: activeSelectionAreas,
    hasSelection: activeSelectionAreas.length > 0,
    isTextEditing,
  };
};

export const moveGridAddress = (address: GridAddress, dx: number, dy: number): GridAddress => ({
  x: address.x + dx,
  y: address.y + dy,
});

export const createGridSelectionState = (
  activeCell: GridAddress = createGridAddress()
): GridSelectionState => ({
  activeCell: { ...activeCell },
  anchorCell: { ...activeCell },
  ranges: [],
});

export const createStaticGridState = (
  activeCell: GridAddress = createGridAddress()
): StaticGridState => ({
  selection: createGridSelectionState(activeCell),
  editMode: "navigate",
});

export const collapseGridSelectionTo = (
  state: GridSelectionState,
  activeCell: GridAddress
): GridSelectionState => ({
  ...state,
  activeCell: { ...activeCell },
  anchorCell: { ...activeCell },
  ranges: [],
});

export const extendGridSelectionTo = (
  state: GridSelectionState,
  activeCell: GridAddress
): GridSelectionState => ({
  ...state,
  activeCell: { ...activeCell },
  ranges: [normalizeGridRange({ start: state.anchorCell, end: activeCell })],
});

export const syncGridSelectionFromLegacy = (
  textCursor: Point | null,
  selections: SelectionArea[],
  fallback: GridSelectionState
): GridSelectionState => {
  if (textCursor) {
    return collapseGridSelectionTo(fallback, textCursor);
  }

  if (selections.length > 0) {
    const ranges = gridRangesFromSelectionAreas(selections);
    const last = ranges[ranges.length - 1];
    return {
      activeCell: { ...last.end },
      anchorCell: { ...last.start },
      ranges,
    };
  }

  return fallback;
};
