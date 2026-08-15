import type { StateCreator } from "zustand";
import type { EditorState, StaticGridSlice } from "../interfaces";
import {
  collapseGridSelectionTo,
  createStaticGridState,
  extendGridSelectionTo,
  getConnectedGridRange,
  getEffectiveGridBounds,
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
    const selection = {
      activeCell: end,
      anchorCell: start,
      ranges: [{ start, end }],
    };
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
    const activeCell = clampPointToActiveSlide(
      state,
      moveGridAddress(current.activeCell, dx, dy)
    );
    const selection = options?.extend
      ? extendGridSelectionTo(current, activeCell)
      : collapseGridSelectionTo(current, activeCell);

    set({
      staticGridSelection: selection,
      staticGridEditMode: options?.extend ? "navigate" : state.staticGridEditMode,
      textCursor: options?.extend ? null : activeCell,
      selections: options?.extend ? selectionAreasFromGridRanges(selection.ranges) : [],
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
      ranges: current.ranges,
      fixedBounds: getActiveSlideGridBounds(state),
    });
    let activeCell = current.activeCell;
    if (edge === "top-left") {
      activeCell = { ...bounds.start };
    } else if (edge === "bottom-right") {
      activeCell = { ...bounds.end };
    } else {
      activeCell = moveGridAddressToEdge(current.activeCell, edge, bounds);
    }
    activeCell = clampPointToActiveSlide(state, activeCell);
    const selection = options?.extend
      ? extendGridSelectionTo(current, activeCell)
      : collapseGridSelectionTo(current, activeCell);
    set({
      staticGridSelection: selection,
      staticGridEditMode: "navigate",
      textCursor: options?.extend ? null : activeCell,
      selections: options?.extend
        ? selectionAreasFromGridRanges(selection.ranges)
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
    const activeCell = clampPointToActiveSlide(
      state,
      moveGridAddressToContentBoundary({
        grid: state.grid,
        address: current.activeCell,
        edge,
        fixedBounds: getActiveSlideGridBounds(state),
      })
    );
    const selection = options?.extend
      ? extendGridSelectionTo(current, activeCell)
      : collapseGridSelectionTo(current, activeCell);
    set({
      staticGridSelection: selection,
      staticGridEditMode: "navigate",
      textCursor: options?.extend ? null : activeCell,
      selections: options?.extend
        ? selectionAreasFromGridRanges(selection.ranges)
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
      ranges: current.ranges,
      fixedBounds: getActiveSlideGridBounds(state),
    });
    const connected = getConnectedGridRange(state.grid, current.activeCell);
    const range =
      current.ranges.length === 1 && gridRangesEqual(current.ranges[0], connected)
        ? bounds
        : connected;
    const selection = selectGridRange(current, range);
    set({
      staticGridSelection: selection,
      staticGridEditMode: "navigate",
      textCursor: null,
      selections: selectionAreasFromGridRanges(selection.ranges),
    });
  },

  selectStaticGridRow: () => {
    const state = get();
    const current = syncGridSelectionFromLegacy(null, state.selections, state.staticGridSelection);
    const bounds = getEffectiveGridBounds({
      grid: state.grid,
      activeCell: current.activeCell,
      ranges: current.ranges,
      fixedBounds: getActiveSlideGridBounds(state),
    });
    const selection = selectGridRow(current, bounds);
    set({
      staticGridSelection: selection,
      staticGridEditMode: "navigate",
      textCursor: null,
      selections: selectionAreasFromGridRanges(selection.ranges),
    });
  },

  selectStaticGridColumn: () => {
    const state = get();
    const current = syncGridSelectionFromLegacy(null, state.selections, state.staticGridSelection);
    const bounds = getEffectiveGridBounds({
      grid: state.grid,
      activeCell: current.activeCell,
      ranges: current.ranges,
      fixedBounds: getActiveSlideGridBounds(state),
    });
    const selection = selectGridColumn(current, bounds);
    set({
      staticGridSelection: selection,
      staticGridEditMode: "navigate",
      textCursor: null,
      selections: selectionAreasFromGridRanges(selection.ranges),
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
