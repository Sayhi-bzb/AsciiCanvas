import type { GridMap, Point, SelectionArea } from "@/shared/types";
import { GridManager } from "@/shared/utils/grid";
import { getGridSelectionGeometry } from "./grid-selection-geometry";

export type GridAddress = Point;
export type GridEditMode = "navigate" | "text-edit";

export interface GridRange {
  start: GridAddress;
  end: GridAddress;
}

export type GridBounds = GridRange;

type GridEdge = "left" | "right" | "top" | "bottom";

export interface GridSelectionState {
  mode: "cell" | "range";
  activeCell: GridAddress;
  anchorCell: GridAddress;
  primaryRange: GridRange;
  additionalRanges: GridRange[];
}

interface StaticGridState {
  selection: GridSelectionState;
  editMode: GridEditMode;
}

interface StaticGridViewState {
  activeCell: GridAddress;
  textCursor: GridAddress | null;
  selectionAreas: SelectionArea[];
  selectionGeometry: import("./grid-selection-geometry").GridSelectionGeometry;
  hasSelection: boolean;
  isTextEditing: boolean;
}

const createGridAddress = (x = 0, y = 0): GridAddress => ({ x, y });

const createSingleCellRange = (address: GridAddress): GridRange => ({
  start: { ...address },
  end: { ...address },
});

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

export const gridRangesEqual = (left: GridRange, right: GridRange) => {
  const a = normalizeGridRange(left);
  const b = normalizeGridRange(right);
  return (
    a.start.x === b.start.x &&
    a.start.y === b.start.y &&
    a.end.x === b.end.x &&
    a.end.y === b.end.y
  );
};

export const getEffectiveGridBounds = (input: {
  grid: GridMap;
  activeCell: GridAddress;
  ranges?: GridRange[];
  fixedBounds?: GridBounds | null;
}): GridBounds => {
  if (input.fixedBounds) return normalizeGridRange(input.fixedBounds);

  let minX = input.activeCell.x;
  let maxX = input.activeCell.x;
  let minY = input.activeCell.y;
  let maxY = input.activeCell.y;
  const include = ({ x, y }: GridAddress) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };

  for (const key of input.grid.keys()) include(GridManager.fromKey(key));
  for (const range of input.ranges ?? []) {
    include(range.start);
    include(range.end);
  }

  return { start: { x: minX, y: minY }, end: { x: maxX, y: maxY } };
};

export const moveGridAddressToEdge = (
  address: GridAddress,
  edge: GridEdge,
  bounds: GridBounds
): GridAddress => {
  const normalized = normalizeGridRange(bounds);
  if (edge === "left") return { x: normalized.start.x, y: address.y };
  if (edge === "right") return { x: normalized.end.x, y: address.y };
  if (edge === "top") return { x: address.x, y: normalized.start.y };
  return { x: address.x, y: normalized.end.y };
};

const getVisibleCellOrigin = (
  grid: GridMap,
  address: GridAddress
): GridAddress | null => {
  const cell = grid.get(GridManager.toKey(address.x, address.y));
  if (cell?.char.trim()) return { ...address };

  const previous = grid.get(GridManager.toKey(address.x - 1, address.y));
  if (previous?.char.trim() && GridManager.getCharWidth(previous.char) === 2) {
    return { x: address.x - 1, y: address.y };
  }
  return null;
};

const getContentNavigationBounds = (input: {
  grid: GridMap;
  activeCell: GridAddress;
  fixedBounds?: GridBounds | null;
}): GridBounds => {
  if (input.fixedBounds) return normalizeGridRange(input.fixedBounds);

  let minX = input.activeCell.x;
  let maxX = input.activeCell.x;
  let minY = input.activeCell.y;
  let maxY = input.activeCell.y;
  GridManager.iterate(input.grid, (cell, x, y) => {
    if (!cell.char.trim()) return;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x + Math.max(1, GridManager.getCharWidth(cell.char)) - 1);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  });
  return { start: { x: minX, y: minY }, end: { x: maxX, y: maxY } };
};

export const moveGridAddressToContentBoundary = (input: {
  grid: GridMap;
  address: GridAddress;
  edge: GridEdge;
  fixedBounds?: GridBounds | null;
}): GridAddress => {
  const bounds = getContentNavigationBounds({
    grid: input.grid,
    activeCell: input.address,
    fixedBounds: input.fixedBounds,
  });
  const step = {
    x: input.edge === "left" ? -1 : input.edge === "right" ? 1 : 0,
    y: input.edge === "top" ? -1 : input.edge === "bottom" ? 1 : 0,
  };
  const withinBounds = ({ x, y }: GridAddress) =>
    x >= bounds.start.x && x <= bounds.end.x && y >= bounds.start.y && y <= bounds.end.y;

  const currentCell = input.grid.get(
    GridManager.toKey(input.address.x, input.address.y)
  );
  const horizontalStep =
    step.x > 0 && currentCell?.char.trim()
      ? Math.max(1, GridManager.getCharWidth(currentCell.char))
      : step.x;
  let cursor = moveGridAddress(input.address, horizontalStep, step.y);
  if (!withinBounds(cursor)) return { ...input.address };

  const adjacentHasContent = getVisibleCellOrigin(input.grid, cursor) !== null;
  if (adjacentHasContent) {
    let lastContent = cursor;
    while (withinBounds(cursor) && getVisibleCellOrigin(input.grid, cursor)) {
      lastContent = cursor;
      cursor = moveGridAddress(cursor, step.x, step.y);
    }
    return getVisibleCellOrigin(input.grid, lastContent) ?? lastContent;
  }

  while (withinBounds(cursor)) {
    const origin = getVisibleCellOrigin(input.grid, cursor);
    if (origin) return origin;
    cursor = moveGridAddress(cursor, step.x, step.y);
  }

  return moveGridAddressToEdge(input.address, input.edge, bounds);
};

export const getConnectedGridRange = (
  grid: GridMap,
  origin: GridAddress
): GridRange => {
  const originKey = GridManager.toKey(origin.x, origin.y);
  if (!grid.has(originKey)) return { start: { ...origin }, end: { ...origin } };

  const visited = new Set<string>();
  const pending = [{ ...origin }];
  let minX = origin.x;
  let maxX = origin.x;
  let minY = origin.y;
  let maxY = origin.y;

  while (pending.length > 0) {
    const point = pending.pop()!;
    const key = GridManager.toKey(point.x, point.y);
    if (visited.has(key) || !grid.has(key)) continue;
    visited.add(key);
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
    pending.push(
      { x: point.x - 1, y: point.y },
      { x: point.x + 1, y: point.y },
      { x: point.x, y: point.y - 1 },
      { x: point.x, y: point.y + 1 }
    );
  }

  return { start: { x: minX, y: minY }, end: { x: maxX, y: maxY } };
};

export const gridRangeFromSelectionArea = (area: SelectionArea): GridRange =>
  normalizeGridRange({ start: area.start, end: area.end });

export const selectionAreaFromGridRange = (range: GridRange): SelectionArea => {
  const normalized = normalizeGridRange(range);
  return {
    start: { ...normalized.start },
    end: { ...normalized.end },
  };
};

const selectionAreasFromGridRanges = (ranges: GridRange[]) =>
  ranges.map(selectionAreaFromGridRange);

export const getGridSelectionRanges = (state: GridSelectionState) => [
  ...state.additionalRanges,
  state.primaryRange,
];

export const getStaticGridSelectionAreas = (state: GridSelectionState) =>
  selectionAreasFromGridRanges(getGridSelectionRanges(state));

export const hasGridRangeSelection = (state: GridSelectionState) => {
  return state.mode === "range";
};

export const getStaticGridViewState = (input: {
  selection: GridSelectionState;
  editMode: GridEditMode;
  textCursor: Point | null;
}): StaticGridViewState => {
  const selectionAreas = getStaticGridSelectionAreas(input.selection);
  const isTextEditing = input.editMode === "text-edit";
  const activeCell = isTextEditing && input.textCursor
    ? { ...input.textCursor }
    : { ...input.selection.activeCell };

  return {
    activeCell,
    textCursor: isTextEditing ? activeCell : null,
    selectionAreas,
    selectionGeometry: getGridSelectionGeometry(getGridSelectionRanges(input.selection)),
    hasSelection: !isTextEditing && hasGridRangeSelection(input.selection),
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
  mode: "cell",
  activeCell: { ...activeCell },
  anchorCell: { ...activeCell },
  primaryRange: createSingleCellRange(activeCell),
  additionalRanges: [],
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
  mode: "cell",
  activeCell: { ...activeCell },
  anchorCell: { ...activeCell },
  primaryRange: createSingleCellRange(activeCell),
  additionalRanges: [],
});

export const extendGridSelectionTo = (
  state: GridSelectionState,
  extentCell: GridAddress
): GridSelectionState => ({
  ...state,
  mode: "range",
  primaryRange: normalizeGridRange({ start: state.anchorCell, end: extentCell }),
  additionalRanges: [],
});

export const getGridSelectionExtent = (
  state: GridSelectionState
): GridAddress => {
  const range = normalizeGridRange(state.primaryRange);
  return {
    x: state.anchorCell.x === range.start.x ? range.end.x : range.start.x,
    y: state.anchorCell.y === range.start.y ? range.end.y : range.start.y,
  };
};

const isGridAddressWithinRange = (
  address: GridAddress,
  range: GridRange
) =>
  address.x >= range.start.x &&
  address.x <= range.end.x &&
  address.y >= range.start.y &&
  address.y <= range.end.y;

export const selectGridRange = (
  state: GridSelectionState,
  range: GridRange,
  options?: { append?: boolean; activeCell?: "start" | "preserve" }
): GridSelectionState => {
  const primaryRange = normalizeGridRange(range);
  const requestedActiveCell =
    options?.activeCell === "start" ? range.start : state.activeCell;
  const activeCell = isGridAddressWithinRange(requestedActiveCell, primaryRange)
    ? requestedActiveCell
    : range.start;
  return {
    ...state,
    mode: "range",
    activeCell: { ...activeCell },
    anchorCell: { ...range.start },
    primaryRange,
    additionalRanges: options?.append
      ? [...state.additionalRanges, state.primaryRange].filter(
          (candidate, index, ranges) =>
            !gridRangesEqual(candidate, primaryRange) &&
            ranges.findIndex((range) => gridRangesEqual(range, candidate)) === index
        )
      : [],
  };
};

export const selectGridRow = (
  state: GridSelectionState,
  bounds: GridBounds
): GridSelectionState => {
  const normalized = normalizeGridRange(bounds);
  return selectGridRange(state, {
    start: { x: normalized.start.x, y: state.activeCell.y },
    end: { x: normalized.end.x, y: state.activeCell.y },
  });
};

export const selectGridColumn = (
  state: GridSelectionState,
  bounds: GridBounds
): GridSelectionState => {
  const normalized = normalizeGridRange(bounds);
  return selectGridRange(state, {
    start: { x: state.activeCell.x, y: normalized.start.y },
    end: { x: state.activeCell.x, y: normalized.end.y },
  });
};
