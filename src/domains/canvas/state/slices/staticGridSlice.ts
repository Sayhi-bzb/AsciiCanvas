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
} from "@/domains/selection/public";
import { clampPointToActiveSlide, getActiveSlideGridBounds } from "../slideBounds";
import { resolveGridAnchor, resolveGridSlot } from "@/shared/utils/grid-occupancy";

const resolveStaticGridAddress = (
  state: EditorState,
  address: { x: number; y: number }
) => resolveGridAnchor(state.grid, clampPointToActiveSlide(state, address));

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
    const activeCell = resolveStaticGridAddress(state, address);
    const selection = collapseGridSelectionTo(state.staticGridSelection, activeCell);
    set({
      staticGridSelection: selection,
      staticGridEditMode: "navigate",
      textCursor: activeCell,
    });
  },

  setStaticGridSelectionRange: (range) => {
    const state = get();
    const start = resolveStaticGridAddress(state, range.start);
    const end = resolveStaticGridAddress(state, range.end);
    const selection = selectGridRange(
      state.staticGridSelection,
      { start, end },
      { activeCell: "start" }
    );
    set({
      staticGridSelection: selection,
      staticGridEditMode: "navigate",
      textCursor: null,
    });
  },

  appendStaticGridSelectionRange: (range) => {
    const state = get();
    const start = resolveStaticGridAddress(state, range.start);
    const end = resolveStaticGridAddress(state, range.end);
    set({
      staticGridSelection: selectGridRange(
        state.staticGridSelection,
        { start, end },
        { append: true, activeCell: "start" }
      ),
      staticGridEditMode: "navigate",
      textCursor: null,
    });
  },

  moveStaticGridFocus: (dx, dy, options) => {
    const state = get();
    const current = state.staticGridSelection;
    const focusCell = options?.extend
      ? getGridSelectionExtent(current)
      : current.activeCell;
    const currentSlot = resolveGridSlot(state.grid, focusCell);
    const visualDx = dx > 0 && currentSlot ? dx + currentSlot.width - 1 : dx;
    const nextCell = resolveStaticGridAddress(
      state,
      moveGridAddress(focusCell, visualDx, dy)
    );
    const selection = options?.extend
      ? extendGridSelectionTo(current, nextCell)
      : collapseGridSelectionTo(current, nextCell);

    set({
      staticGridSelection: selection,
      staticGridEditMode: options?.extend ? "navigate" : state.staticGridEditMode,
      textCursor: options?.extend ? null : nextCell,
    });
  },

  moveStaticGridFocusToEdge: (edge, options) => {
    const state = get();
    const current = state.staticGridSelection;
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
    nextCell = resolveStaticGridAddress(state, nextCell);
    const selection = options?.extend
      ? extendGridSelectionTo(current, nextCell)
      : collapseGridSelectionTo(current, nextCell);
    set({
      staticGridSelection: selection,
      staticGridEditMode: "navigate",
      textCursor: options?.extend ? null : nextCell,
    });
  },

  moveStaticGridFocusToContentBoundary: (edge, options) => {
    const state = get();
    const current = state.staticGridSelection;
    const focusCell = options?.extend
      ? getGridSelectionExtent(current)
      : current.activeCell;
    const nextCell = resolveStaticGridAddress(
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
    });
  },

  selectStaticGridAll: () => {
    const state = get();
    const current = state.staticGridSelection;
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
    });
  },

  selectStaticGridRow: () => {
    const state = get();
    const current = state.staticGridSelection;
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
    });
  },

  selectStaticGridColumn: () => {
    const state = get();
    const current = state.staticGridSelection;
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
    });
  },

  enterStaticGridTextEdit: (address) => {
    const state = get();
    const current = state.staticGridSelection;
    const activeCell = resolveStaticGridAddress(
      state,
      address ?? current.activeCell
    );
    set({
      staticGridSelection: collapseGridSelectionTo(current, activeCell),
      staticGridEditMode: "text-edit",
      textCursor: activeCell,
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
    });
  },
});
