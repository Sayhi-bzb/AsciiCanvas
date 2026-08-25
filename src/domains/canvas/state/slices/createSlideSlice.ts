import type { StateCreator } from "zustand";
import type { CanvasDocumentRegistry } from "../CanvasDocumentRegistry";
import {
  activateSlide as activateDeckSlide,
  addSlide as addDeckSlide,
  createSlideId,
  duplicateSlide as duplicateDeckSlide,
  moveSlide as moveDeckSlide,
  removeSlide as removeDeckSlide,
  renameSlide as renameDeckSlide,
  resizeSlide as resizeDeckSlide,
  getSlideResizeCropCount,
} from "@/domains/slides/public";
import type { EditorState, SlideSlice } from "../interfaces";
import { createSlideActivationPatch } from "../transitions/editorTransitions";
import {
  activateSlidePage,
  ensureSlidePage,
  readSlideGrid,
  replaceSlideDeckSession,
  removeSlidePage,
  resetSlidePage,
} from "../slideDocumentPages";
import { stripSlideDeckContent } from "../helpers/storeUtils";

export const createSlideSlice = (
  documents: CanvasDocumentRegistry
): StateCreator<
  EditorState,
  [],
  [],
  SlideSlice
> => (set, get) => ({
  slideDeck: null,

  addSlide: () => {
    const state = get();
    if (state.canvasMode !== "slide" || !state.slideDeck) return;
    const next = addDeckSlide(state.slideDeck, {
      id: createSlideId(state.slideDeck.slides),
    });
    const active = next.slides.find((slide) => slide.id === next.activeSlideId);
    if (!active) return;
    const activeGrid = activateSlidePage(
      documents,
      state.activeCanvasId,
      active.id,
      []
    );
    documents.updatePage(state.activeCanvasId, active.id, {
      name: active.name,
      size: active.size,
    });
    set(createSlideActivationPatch(state, stripSlideDeckContent(next), activeGrid));
  },

  duplicateSlide: (slideId) => {
    const state = get();
    if (state.canvasMode !== "slide" || !state.slideDeck) return;
    const source = state.slideDeck.slides.find((slide) => slide.id === slideId);
    if (!source) return;
    const sourceGrid = readSlideGrid(
      documents,
      state.activeCanvasId,
      slideId,
      source.grid
    );
    const hydrated = {
      ...state.slideDeck,
      slides: state.slideDeck.slides.map((slide) =>
        slide.id === slideId ? { ...slide, grid: sourceGrid } : slide
      ),
    };
    const next = duplicateDeckSlide(hydrated, {
      sourceSlideId: slideId,
      id: createSlideId(hydrated.slides),
    });
    if (next === hydrated) return;
    const active = next.slides.find((slide) => slide.id === next.activeSlideId);
    if (!active) return;
    const activeGrid = activateSlidePage(
      documents,
      state.activeCanvasId,
      active.id,
      active.grid
    );
    documents.updatePage(state.activeCanvasId, active.id, {
      name: active.name,
      size: active.size,
    });
    set(createSlideActivationPatch(state, stripSlideDeckContent(next), activeGrid));
  },

  removeSlide: (slideId) => {
    const state = get();
    if (state.canvasMode !== "slide" || !state.slideDeck) return;
    const next = removeDeckSlide(state.slideDeck, slideId);
    if (next === state.slideDeck) return;
    const active = next.slides.find((slide) => slide.id === next.activeSlideId);
    if (!active) return;
    const activeGrid = activateSlidePage(
      documents,
      state.activeCanvasId,
      active.id,
      active.grid
    );
    set(createSlideActivationPatch(state, stripSlideDeckContent(next), activeGrid));
    removeSlidePage(documents, state.activeCanvasId, slideId);
  },

  renameSlide: (slideId, name) => {
    const state = get();
    if (state.canvasMode !== "slide" || !state.slideDeck) return;
    const next = renameDeckSlide(state.slideDeck, slideId, name);
    if (next === state.slideDeck) return;
    documents.updatePage(state.activeCanvasId, slideId, { name });
    set({
      slideDeck: next,
      canvasSessions: replaceSlideDeckSession(state.canvasSessions, state.activeCanvasId, next),
    });
  },

  moveSlide: (slideId, targetIndex) => {
    const state = get();
    if (state.canvasMode !== "slide" || !state.slideDeck) return;
    const next = moveDeckSlide(state.slideDeck, slideId, targetIndex);
    if (next === state.slideDeck) return;
    documents.reorderPages(
      state.activeCanvasId,
      next.slides.map((slide) => slide.id)
    );
    set({
      slideDeck: next,
      canvasSessions: replaceSlideDeckSession(state.canvasSessions, state.activeCanvasId, next),
    });
  },

  activateSlide: (slideId) => {
    const state = get();
    if (
      state.canvasMode !== "slide" ||
      !state.slideDeck ||
      state.slideDeck.activeSlideId === slideId
    ) {
      return;
    }
    const next = activateDeckSlide(state.slideDeck, slideId);
    if (next === state.slideDeck) return;
    const active = next.slides.find((slide) => slide.id === slideId);
    if (!active) return;
    const activeGrid = activateSlidePage(
      documents,
      state.activeCanvasId,
      active.id,
      active.grid
    );
    set(createSlideActivationPatch(state, stripSlideDeckContent(next), activeGrid));
  },

  resizeSlide: (slideId, size) => {
    const state = get();
    if (state.canvasMode !== "slide" || !state.slideDeck) return;
    const source = state.slideDeck.slides.find((slide) => slide.id === slideId);
    if (!source) return;
    const sourceWithGrid = {
      ...source,
      grid: readSlideGrid(
        documents,
        state.activeCanvasId,
        slideId,
        source.grid
      ),
    };
    const cropCount = getSlideResizeCropCount(sourceWithGrid, size);
    const hydrated = {
      ...state.slideDeck,
      slides: state.slideDeck.slides.map((slide) =>
        slide.id === slideId ? sourceWithGrid : slide
      ),
    };
    const contentNext = resizeDeckSlide(hydrated, slideId, size);
    if (contentNext === hydrated) return;
    const next = stripSlideDeckContent(contentNext);
    const resizedContent = contentNext.slides.find((slide) => slide.id === slideId);
    const active = next.slides.find((slide) => slide.id === next.activeSlideId);
    if (!active || !resizedContent) return;
    documents.updatePage(state.activeCanvasId, slideId, { size });

    if (cropCount > 0) {
      resetSlidePage(
        documents,
        state.activeCanvasId,
        resizedContent.id,
        resizedContent.grid
      );
    } else {
      ensureSlidePage(
        documents,
        state.activeCanvasId,
        resizedContent.id,
        resizedContent.grid
      );
    }

    if (slideId === next.activeSlideId) {
      const activeGrid = activateSlidePage(
        documents,
        state.activeCanvasId,
        active.id,
        resizedContent.grid
      );
      set(createSlideActivationPatch(state, next, activeGrid));
      return;
    }
    set({
      slideDeck: next,
      canvasSessions: replaceSlideDeckSession(state.canvasSessions, state.activeCanvasId, next),
    });
  },
});
