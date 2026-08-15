import type { StateCreator } from "zustand";
import type { EditorState, StaticGridSlice } from "../interfaces";
import {
  collapseGridSelectionTo,
  createStaticGridState,
  extendGridSelectionTo,
  getConnectedGridRange,
  getEffectiveGridBounds,
  getGridSelectionExtent,
  getGridSelectionRanges,
  gridRangesEqual,
  moveGridAddress,
  moveGridAddressToContentBoundary,
  moveGridAddressToEdge,
  selectGridColumn,
  selectGridRange,
  selectGridRow,
  selectionAreaFromGridRange,
  selectionAreasFromGridRanges,
  syncGridSelectionFromLegacy,
} from "@/domains/selection/public";
import { clampPointToActiveSlide, getActiveSlideGridBounds } from "../slideBounds";

export const createStaticGridSlice: StateCreator<
  EditorState,
  [],
  [],
  StaticGridSlice
> = (set, get) => ({
  staticGridSelection: createStaticGridState().selection,
  staticGridEditMode: "navigate",

  setStaticGridActiveCell: (address) => {
    const state = get();
    const activeCell = clampPointToActiveSlide(state, address);
    const selection = collapseGridSelectionTo(
      syncGridSelectionFromLegacy(state.textCursor, state.selections, state.staticGridSelection),
      activeCell
    );
    set({
      staticGridSelection: selection,
      staticGridEditMode: "navigate",
      textCursor: activeCell,
      selections: [],
    });
  },

  setStaticGridSelectionRange: (range) => {
    const state = get();
    const start = clampPointToActiveSlide(state, range.start);
    const end = clampPointToActiveSlide(state, range.end);
    const selection = selectGridRange(
      state.staticGridSelection,
      { start, end },
      { activeCell: "start" }
    );
    set({
      staticGridSelection: selection,
      staticGridEditMode: "navigate",
      textCursor: null,
      selections: [selectionAreaFromGridRange({ start, end })],
    });
  },

  moveStaticGridFocus: (dx, dy, options) => {
    const state = get();
    const current = options?.extend
      ? state.staticGridSelection
      : syncGridSelectionFromLegacy(
          state.textCursor,
          state.selections,
          state.staticGridSelection
        );
    const focusCell = options?.extend
      ? getGridSelectionExtent(current)
      : current.activeCell;
    const nextCell = clampPointToActiveSlide(
      state,
      moveGridAddress(focusCell, dx, dy)
    );
    const selection = options?.extend
      ? extendGridSelectionTo(current, nextCell)
      : collapseGridSelectionTo(current, nextCell);

    set({
      staticGridSelection: selection,
      staticGridEditMode: options?.extend ? "navigate" : state.staticGridEditMode,
      textCursor: options?.extend ? null : nextCell,
      selections: options?.extend
        ? selectionAreasFromGridRanges(getGridSelectionRanges(selection))
        : [],
    });
  },

  moveStaticGridFocusToEdge: (edge, options) => {
    const state = get();
    const current = syncGridSelectionFromLegacy(
      state.staticGridEditMode === "text-edit" ? state.textCursor : null,
      state.selections,
      state.staticGridSelection
    );
    const bounds = getEffectiveGridBounds({
      grid: state.grid,
      activeCell: current.activeCell,
      ranges: getGridSelectionRanges(current),
      fixedBounds: getActiveSlideGridBounds(state),
    });
    const focusCell = options?.extend
      ? getGridSelectionExtent(current)
      : current.activeCell;
    let nextCell = focusCell;
    if (edge === "top-left") {
      nextCell = { ...bounds.start };
    } else if (edge === "bottom-right") {
      nextCell = { ...bounds.end };
    } else {
      nextCell = moveGridAddressToEdge(focusCell, edge, bounds);
    }
    nextCell = clampPointToActiveSlide(state, nextCell);
    const selection = options?.extend
      ? extendGridSelectionTo(current, nextCell)
      : collapseGridSelectionTo(current, nextCell);
    set({
      staticGridSelection: selection,
      staticGridEditMode: "navigate",
      textCursor: options?.extend ? null : nextCell,
      selections: options?.extend
        ? selectionAreasFromGridRanges(getGridSelectionRanges(selection))
        : [],
    });
  },

  moveStaticGridFocusToContentBoundary: (edge, options) => {
    const state = get();
    const current = syncGridSelectionFromLegacy(
      state.staticGridEditMode === "text-edit" ? state.textCursor : null,
      state.selections,
      state.staticGridSelection
    );
    const focusCell = options?.extend
      ? getGridSelectionExtent(current)
      : current.activeCell;
    const nextCell = clampPointToActiveSlide(
      state,
      moveGridAddressToContentBoundary({
        grid: state.grid,
        address: focusCell,
        edge,
        fixedBounds: getActiveSlideGridBounds(state),
      })
    );
    const selection = options?.extend
      ? extendGridSelectionTo(current, nextCell)
      : collapseGridSelectionTo(current, nextCell);
    set({
      staticGridSelection: selection,
      staticGridEditMode: "navigate",
      textCursor: options?.extend ? null : nextCell,
      selections: options?.extend
        ? selectionAreasFromGridRanges(getGridSelectionRanges(selection))
        : [],
    });
  },

  selectStaticGridAll: () => {
    const state = get();
    const current = syncGridSelectionFromLegacy(
      state.staticGridEditMode === "text-edit" ? state.textCursor : null,
      state.selections,
      state.staticGridSelection
    );
    const bounds = getEffectiveGridBounds({
      grid: state.grid,
      activeCell: current.activeCell,
      ranges: getGridSelectionRanges(current),
      fixedBounds: getActiveSlideGridBounds(state),
    });
    const connected = getConnectedGridRange(state.grid, current.activeCell);
    const range =
      current.additionalRanges.length === 0 &&
      gridRangesEqual(current.primaryRange, connected)
        ? bounds
        : connected;
    const selection = selectGridRange(current, range);
    set({
      staticGridSelection: selection,
      staticGridEditMode: "navigate",
      textCursor: null,
      selections: selectionAreasFromGridRanges(getGridSelectionRanges(selection)),
    });
  },

  selectStaticGridRow: () => {
    const state = get();
    const current = syncGridSelectionFromLegacy(null, state.selections, state.staticGridSelection);
    const bounds = getEffectiveGridBounds({
      grid: state.grid,
      activeCell: current.activeCell,
      ranges: getGridSelectionRanges(current),
      fixedBounds: getActiveSlideGridBounds(state),
    });
    const selection = selectGridRow(current, bounds);
    set({
      staticGridSelection: selection,
      staticGridEditMode: "navigate",
      textCursor: null,
      selections: selectionAreasFromGridRanges(getGridSelectionRanges(selection)),
    });
  },

  selectStaticGridColumn: () => {
    const state = get();
    const current = syncGridSelectionFromLegacy(null, state.selections, state.staticGridSelection);
    const bounds = getEffectiveGridBounds({
      grid: state.grid,
      activeCell: current.activeCell,
      ranges: getGridSelectionRanges(current),
      fixedBounds: getActiveSlideGridBounds(state),
    });
    const selection = selectGridColumn(current, bounds);
    set({
      staticGridSelection: selection,
      staticGridEditMode: "navigate",
      textCursor: null,
      selections: selectionAreasFromGridRanges(getGridSelectionRanges(selection)),
    });
  },

  enterStaticGridTextEdit: (address) => {
    const state = get();
    const current = syncGridSelectionFromLegacy(
      state.textCursor,
      state.selections,
      state.staticGridSelection
    );
    const activeCell = clampPointToActiveSlide(state, address ?? current.activeCell);
    set({
      staticGridSelection: collapseGridSelectionTo(current, activeCell),
      staticGridEditMode: "text-edit",
      textCursor: activeCell,
      selections: [],
    });
  },

  exitStaticGridTextEdit: () => {
    const activeCell = get().staticGridSelection.activeCell;
    set({ staticGridEditMode: "navigate", textCursor: activeCell });
  },

  clearStaticGridSelection: () => {
    const state = get();
    const current = state.staticGridSelection;
    set({
      staticGridSelection: collapseGridSelectionTo(current, current.activeCell),
      staticGridEditMode: "navigate",
      textCursor: null,
      selections: [],
    });
  },
});
