import type { CanvasSession } from "@/domains/sessions/public";
import { updateSlideGrid, type SlideDeck } from "@/domains/slides/public";
import type { GridCell, GridMap } from "@/shared/types";
import { createGridMap } from "@/shared/utils/grid-codec";
import type { EditorState } from "./interfaces";
import {
  activateCanvasDocument,
  destroyCanvasDocument,
  resetCanvasDocument,
} from "./canvasDocument";

/**
 * A slide deck is durable state. Its active Yjs document is only an editing
 * buffer and must be projected back into the deck before changing pages.
 */
export const getSlideEditingBufferId = (sessionId: string, slideId: string) =>
  `${sessionId}:slide:${slideId}`;

export const commitActiveSlideGrid = (
  state: Pick<EditorState, "slideDeck" | "grid">
) =>
  state.slideDeck
    ? updateSlideGrid(
        state.slideDeck,
        state.slideDeck.activeSlideId,
        Array.from(state.grid.entries())
      )
    : null;

export const replaceSlideDeckSession = (
  sessions: CanvasSession[],
  sessionId: string,
  slideDeck: SlideDeck
) =>
  sessions.map((session): CanvasSession =>
    session.id === sessionId && session.mode === "slide"
      ? { ...session, slideDeck }
      : session
  );

export const activateSlideEditingBuffer = (
  sessionId: string,
  slideId: string,
  grid: [string, GridCell][]
) =>
  activateCanvasDocument(getSlideEditingBufferId(sessionId, slideId), {
    grid,
    scene: [],
    components: [],
  });

export const resetSlideEditingBuffer = (
  sessionId: string,
  slideId: string,
  grid: [string, GridCell][]
) =>
  resetCanvasDocument(getSlideEditingBufferId(sessionId, slideId), {
    grid,
    scene: [],
    components: [],
  });

export const discardSlideEditingBuffer = (sessionId: string, slideId: string) =>
  destroyCanvasDocument(getSlideEditingBufferId(sessionId, slideId));

export const projectSlideEditingBuffer = (
  state: Pick<EditorState, "slideDeck" | "canvasSessions" | "activeCanvasId">,
  grid: GridMap
) => {
  if (!state.slideDeck) return null;
  const slideDeck = updateSlideGrid(
    state.slideDeck,
    state.slideDeck.activeSlideId,
    Array.from(grid.entries())
  );
  const activeSlide = slideDeck.slides.find(
    (slide) => slide.id === slideDeck.activeSlideId
  );
  return {
    slideDeck,
    grid: createGridMap(activeSlide?.grid ?? []),
    canvasSessions: replaceSlideDeckSession(
      state.canvasSessions,
      state.activeCanvasId,
      slideDeck
    ),
  };
};
