import type { StateCreator } from "zustand";
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
  activateSlideEditingBuffer,
  commitActiveSlideGrid,
  discardSlideEditingBuffer,
  replaceSlideDeckSession,
  resetSlideEditingBuffer,
} from "../slideEditingBuffer";

export const createSlideSlice: StateCreator<
  EditorState,
  [],
  [],
  SlideSlice
> = (set, get) => ({
  slideDeck: null,

  addSlide: () => {
    const state = get();
    const synced = commitActiveSlideGrid(state);
    if (state.canvasMode !== "slide" || !synced) return;
    const next = addDeckSlide(synced, { id: createSlideId(synced.slides) });
    const active = next.slides.find((slide) => slide.id === next.activeSlideId);
    if (!active) return;
    activateSlideEditingBuffer(state.activeCanvasId, active.id, active.grid);
    set(createSlideActivationPatch(state, next, active.grid));
  },

  duplicateSlide: (slideId) => {
    const state = get();
    const synced = commitActiveSlideGrid(state);
    if (state.canvasMode !== "slide" || !synced) return;
    const next = duplicateDeckSlide(synced, {
      sourceSlideId: slideId,
      id: createSlideId(synced.slides),
    });
    if (next === synced) return;
    const active = next.slides.find((slide) => slide.id === next.activeSlideId);
    if (!active) return;
    activateSlideEditingBuffer(state.activeCanvasId, active.id, active.grid);
    set(createSlideActivationPatch(state, next, active.grid));
  },

  removeSlide: (slideId) => {
    const state = get();
    const synced = commitActiveSlideGrid(state);
    if (state.canvasMode !== "slide" || !synced) return;
    const next = removeDeckSlide(synced, slideId);
    if (next === synced) return;
    const active = next.slides.find((slide) => slide.id === next.activeSlideId);
    if (!active) return;
    activateSlideEditingBuffer(state.activeCanvasId, active.id, active.grid);
    set(createSlideActivationPatch(state, next, active.grid));
    discardSlideEditingBuffer(state.activeCanvasId, slideId);
  },

  renameSlide: (slideId, name) => {
    const state = get();
    if (state.canvasMode !== "slide" || !state.slideDeck) return;
    const next = renameDeckSlide(state.slideDeck, slideId, name);
    if (next === state.slideDeck) return;
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
    set({
      slideDeck: next,
      canvasSessions: replaceSlideDeckSession(state.canvasSessions, state.activeCanvasId, next),
    });
  },

  activateSlide: (slideId) => {
    const state = get();
    const synced = commitActiveSlideGrid(state);
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
    activateSlideEditingBuffer(state.activeCanvasId, active.id, active.grid);
    set(createSlideActivationPatch(state, next, active.grid));
  },

  resizeSlide: (slideId, size) => {
    const state = get();
    const synced = commitActiveSlideGrid(state);
    if (state.canvasMode !== "slide" || !synced) return;
    const source = synced.slides.find((slide) => slide.id === slideId);
    if (!source) return;
    const cropCount = getSlideResizeCropCount(source, size);
    const next = resizeDeckSlide(synced, slideId, size);
    if (next === synced) return;
    const active = next.slides.find((slide) => slide.id === next.activeSlideId);
    const resized = next.slides.find((slide) => slide.id === slideId);
    if (!active || !resized) return;

    if (cropCount > 0) {
      resetSlideEditingBuffer(state.activeCanvasId, resized.id, resized.grid);
    }

    if (slideId === next.activeSlideId) {
      set(createSlideActivationPatch(state, next, active.grid));
      return;
    }
    set({
      slideDeck: next,
      canvasSessions: replaceSlideDeckSession(state.canvasSessions, state.activeCanvasId, next),
    });
  },
});
