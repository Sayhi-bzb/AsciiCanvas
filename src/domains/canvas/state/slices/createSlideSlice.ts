import type { StateCreator } from "zustand";
import type { GridCell } from "@/shared/types";
import {
  activateSlide as activateDeckSlide,
  addSlide as addDeckSlide,
  createSlideId,
  duplicateSlide as duplicateDeckSlide,
  moveSlide as moveDeckSlide,
  removeSlide as removeDeckSlide,
  renameSlide as renameDeckSlide,
  updateSlideGrid,
} from "@/domains/slides/public";
import type { EditorState, SlideSlice } from "../interfaces";
import { createStaticGridState } from "@/domains/selection/public";
import { createMapFromEntries, serializeGrid } from "../helpers/snapshotHelpers";
import { getSlideCanvasDocumentId } from "../helpers/storeUtils";
import { activateCanvasDocument, destroyCanvasDocument } from "../yjs";

const syncActiveGrid = (state: EditorState) => {
  if (!state.slideDeck) return null;
  return updateSlideGrid(
    state.slideDeck,
    state.slideDeck.activeSlideId,
    serializeGrid(state.grid)
  );
};

const replaceDeckSession = (state: EditorState, slideDeck: NonNullable<EditorState["slideDeck"]>) =>
  state.canvasSessions.map((session) =>
    session.id === state.activeCanvasId && session.mode === "slide"
      ? { ...session, slideDeck }
      : session
  );

const resetPageInteraction = {
  selections: [],
  textCursor: null,
  hoveredGrid: null,
  scratchLayer: null,
  staticGridSelection: createStaticGridState().selection,
  staticGridEditMode: "navigate" as const,
};

const activatePageDocument = (
  sessionId: string,
  slideId: string,
  grid: [string, GridCell][]
) =>
  activateCanvasDocument(getSlideCanvasDocumentId(sessionId, slideId), {
    grid,
    scene: [],
    components: [],
  });

export const createSlideSlice: StateCreator<
  EditorState,
  [],
  [],
  SlideSlice
> = (set, get) => ({
  slideDeck: null,

  addSlide: () => {
    const state = get();
    const synced = syncActiveGrid(state);
    if (state.canvasMode !== "slide" || !synced) return;
    const next = addDeckSlide(synced, { id: createSlideId(synced.slides) });
    const active = next.slides.find((slide) => slide.id === next.activeSlideId);
    if (!active) return;
    activatePageDocument(state.activeCanvasId, active.id, active.grid);
    set({
      slideDeck: next,
      canvasSessions: replaceDeckSession(state, next),
      grid: createMapFromEntries(active.grid),
      ...resetPageInteraction,
    });
  },

  duplicateSlide: (slideId) => {
    const state = get();
    const synced = syncActiveGrid(state);
    if (state.canvasMode !== "slide" || !synced) return;
    const next = duplicateDeckSlide(synced, {
      sourceSlideId: slideId,
      id: createSlideId(synced.slides),
    });
    if (next === synced) return;
    const active = next.slides.find((slide) => slide.id === next.activeSlideId);
    if (!active) return;
    activatePageDocument(state.activeCanvasId, active.id, active.grid);
    set({
      slideDeck: next,
      canvasSessions: replaceDeckSession(state, next),
      grid: createMapFromEntries(active.grid),
      ...resetPageInteraction,
    });
  },

  removeSlide: (slideId) => {
    const state = get();
    const synced = syncActiveGrid(state);
    if (state.canvasMode !== "slide" || !synced) return;
    const next = removeDeckSlide(synced, slideId);
    if (next === synced) return;
    const active = next.slides.find((slide) => slide.id === next.activeSlideId);
    if (!active) return;
    activatePageDocument(state.activeCanvasId, active.id, active.grid);
    set({
      slideDeck: next,
      canvasSessions: replaceDeckSession(state, next),
      grid: createMapFromEntries(active.grid),
      ...resetPageInteraction,
    });
    destroyCanvasDocument(getSlideCanvasDocumentId(state.activeCanvasId, slideId));
  },

  renameSlide: (slideId, name) => {
    const state = get();
    if (state.canvasMode !== "slide" || !state.slideDeck) return;
    const next = renameDeckSlide(state.slideDeck, slideId, name);
    if (next === state.slideDeck) return;
    set({
      slideDeck: next,
      canvasSessions: replaceDeckSession(state, next),
    });
  },

  moveSlide: (slideId, targetIndex) => {
    const state = get();
    if (state.canvasMode !== "slide" || !state.slideDeck) return;
    const next = moveDeckSlide(state.slideDeck, slideId, targetIndex);
    if (next === state.slideDeck) return;
    set({
      slideDeck: next,
      canvasSessions: replaceDeckSession(state, next),
    });
  },

  activateSlide: (slideId) => {
    const state = get();
    const synced = syncActiveGrid(state);
    if (
      state.canvasMode !== "slide" ||
      !synced ||
      synced.activeSlideId === slideId
    ) {
      return;
    }
    const next = activateDeckSlide(synced, slideId);
    if (next === synced) return;
    const active = next.slides.find((slide) => slide.id === slideId);
    if (!active) return;
    activatePageDocument(state.activeCanvasId, active.id, active.grid);
    set({
      slideDeck: next,
      canvasSessions: replaceDeckSession(state, next),
      grid: createMapFromEntries(active.grid),
      ...resetPageInteraction,
    });
  },
});
