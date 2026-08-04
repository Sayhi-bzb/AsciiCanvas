import type { StateCreator } from "zustand";
import type { EditorState, StaticGridSlice } from "../interfaces";
import {
  collapseGridSelectionTo,
  createStaticGridState,
  extendGridSelectionTo,
  moveGridAddress,
  selectionAreaFromGridRange,
  selectionAreasFromGridRanges,
  syncGridSelectionFromLegacy,
} from "@/domains/selection/public";

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
    const activeCell = address;
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
    const start = range.start;
    const end = range.end;
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
    const activeCell = moveGridAddress(current.activeCell, dx, dy);
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
    const activeCell = address ?? current.activeCell;
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
