import type { EditorState } from "./interfaces";
import type { Point } from "@/shared/types";

type SlideBoundState = Pick<EditorState, "canvasMode" | "slideDeck">;

export const getActiveSlideSize = (state: SlideBoundState) =>
  state.canvasMode === "slide"
    ? state.slideDeck?.slides.find(
        (slide) => slide.id === state.slideDeck?.activeSlideId
      )?.size ?? null
    : null;

export const isPointWithinActiveSlide = (state: SlideBoundState, point: Point) => {
  const size = getActiveSlideSize(state);
  return !size || (point.x >= 0 && point.x < size.columns && point.y >= 0 && point.y < size.rows);
};

export const clampPointToActiveSlide = (state: SlideBoundState, point: Point): Point => {
  const size = getActiveSlideSize(state);
  if (!size) return point;
  return {
    x: Math.min(size.columns - 1, Math.max(0, point.x)),
    y: Math.min(size.rows - 1, Math.max(0, point.y)),
  };
};
