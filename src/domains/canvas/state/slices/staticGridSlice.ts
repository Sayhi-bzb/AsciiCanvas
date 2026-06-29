import type { StateCreator } from "zustand";
import type { CanvasState, StaticGridSlice } from "../interfaces";
import {
  collapseGridSelectionTo,
  createStaticGridState,
  extendGridSelectionTo,
  moveGridAddress,
  selectionAreaFromGridRange,
  selectionAreasFromGridRanges,
  syncGridSelectionFromLegacy,
  type GridAddress,
} from "../helpers/staticGridModel";
import { clampPointToBounds } from "../helpers/animationHelpers";

const clampStaticAddress = (address: GridAddress, state: CanvasState) =>
  clampPointToBounds(address, state.canvasBounds);

export const createStaticGridSlice: StateCreator<
  CanvasState,
  [],
  [],
  StaticGridSlice
> = (set, get) => ({
  staticGridSelection: createStaticGridState().selection,
  staticGridEditMode: "navigate",

  setStaticGridActiveCell: (address) => {
    const state = get();
    const activeCell = clampStaticAddress(address, state);
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
    const start = clampStaticAddress(range.start, state);
    const end = clampStaticAddress(range.end, state);
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
    const activeCell = clampStaticAddress(
      moveGridAddress(current.activeCell, dx, dy),
      state
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

  enterStaticGridTextEdit: (address) => {
    const state = get();
    const current = syncGridSelectionFromLegacy(
      state.textCursor,
      state.selections,
      state.staticGridSelection
    );
    const activeCell = clampStaticAddress(address ?? current.activeCell, state);
    set({
      staticGridSelection: collapseGridSelectionTo(current, activeCell),
      staticGridEditMode: "text-edit",
      textCursor: activeCell,
      selections: [],
    });
  },

  exitStaticGridTextEdit: () => {
    set({ staticGridEditMode: "navigate" });
  },

  clearStaticGridSelection: () => {
    const state = get();
    const current = syncGridSelectionFromLegacy(
      state.textCursor,
      state.selections,
      state.staticGridSelection
    );
    set({
      staticGridSelection: collapseGridSelectionTo(current, current.activeCell),
      staticGridEditMode: "navigate",
      textCursor: null,
      selections: [],
    });
  },
});
