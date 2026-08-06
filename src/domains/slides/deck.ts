import type { GridCell } from "@/shared/types";
import { normalizeSlideGridEntries } from "./grid";
import {
  DEFAULT_SLIDE_SIZE,
  type Slide,
  type SlideDeck,
  type SlideSize,
} from "./model";
import { isValidSlideSize } from "./grid";

type CreateSlideDeckInput = {
  initialSlideId: string;
  initialSlideName?: string;
  initialGrid?: ReadonlyArray<readonly [string, GridCell]>;
  size?: SlideSize;
};

type AddSlideInput = {
  id: string;
  name?: string;
  grid?: ReadonlyArray<readonly [string, GridCell]>;
  afterSlideId?: string;
};

type DuplicateSlideInput = {
  sourceSlideId: string;
  id: string;
  name?: string;
};

const hasUsableId = (id: string) => id.trim().length > 0;

const hasSlide = (deck: SlideDeck, id: string) =>
  deck.slides.some((slide) => slide.id === id);

export const createSlideId = (slides: readonly Slide[]) => {
  const existing = new Set(slides.map((slide) => slide.id));
  let candidate = "";
  do {
    candidate = `slide-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
  } while (existing.has(candidate));
  return candidate;
};

export const resolveNextSlideName = (slides: readonly Slide[]) => {
  let maxIndex = 0;
  slides.forEach((slide) => {
    const match = slide.name.match(/^Slide\s+(\d+)$/i);
    if (!match) return;
    maxIndex = Math.max(maxIndex, Number(match[1]));
  });
  return `Slide ${maxIndex + 1}`;
};

const resolveName = (name: string | undefined, fallback: string) => {
  const trimmed = name?.trim();
  return trimmed || fallback;
};

export const createSlideDeck = ({
  initialSlideId,
  initialSlideName,
  initialGrid = [],
  size = DEFAULT_SLIDE_SIZE,
}: CreateSlideDeckInput): SlideDeck => {
  if (!hasUsableId(initialSlideId)) {
    throw new Error("A slide deck requires a non-empty initial slide ID");
  }
  if (!isValidSlideSize(size)) {
    throw new RangeError("Slide size must use positive integer columns and rows");
  }

  const normalizedSize = { ...size };
  const initialSlide: Slide = {
    id: initialSlideId,
    name: resolveName(initialSlideName, "Slide 1"),
    grid: normalizeSlideGridEntries(initialGrid, normalizedSize),
  };
  return {
    size: normalizedSize,
    slides: [initialSlide],
    activeSlideId: initialSlide.id,
  };
};

export const addSlide = (deck: SlideDeck, input: AddSlideInput): SlideDeck => {
  if (!hasUsableId(input.id) || hasSlide(deck, input.id)) return deck;
  const afterSlideId = input.afterSlideId ?? deck.activeSlideId;
  const afterIndex = deck.slides.findIndex((slide) => slide.id === afterSlideId);
  if (afterIndex < 0) return deck;

  const slide: Slide = {
    id: input.id,
    name: resolveName(input.name, resolveNextSlideName(deck.slides)),
    grid: normalizeSlideGridEntries(input.grid ?? [], deck.size),
  };
  const slides = [...deck.slides];
  slides.splice(afterIndex + 1, 0, slide);
  return { ...deck, slides, activeSlideId: slide.id };
};

export const duplicateSlide = (
  deck: SlideDeck,
  input: DuplicateSlideInput
): SlideDeck => {
  const source = deck.slides.find((slide) => slide.id === input.sourceSlideId);
  if (!source) return deck;
  return addSlide(deck, {
    id: input.id,
    name: input.name,
    grid: source.grid,
    afterSlideId: source.id,
  });
};

export const removeSlide = (deck: SlideDeck, slideId: string): SlideDeck => {
  if (deck.slides.length <= 1) return deck;
  const removeIndex = deck.slides.findIndex((slide) => slide.id === slideId);
  if (removeIndex < 0) return deck;

  const slides = deck.slides.filter((slide) => slide.id !== slideId);
  if (deck.activeSlideId !== slideId) return { ...deck, slides };
  const fallbackIndex = removeIndex === 0 ? 0 : removeIndex - 1;
  return { ...deck, slides, activeSlideId: slides[fallbackIndex].id };
};

export const renameSlide = (
  deck: SlideDeck,
  slideId: string,
  name: string
): SlideDeck => {
  const trimmed = name.trim();
  if (!trimmed || !hasSlide(deck, slideId)) return deck;
  return {
    ...deck,
    slides: deck.slides.map((slide) =>
      slide.id === slideId ? { ...slide, name: trimmed } : slide
    ),
  };
};

export const activateSlide = (deck: SlideDeck, slideId: string): SlideDeck =>
  hasSlide(deck, slideId) ? { ...deck, activeSlideId: slideId } : deck;

export const moveSlide = (
  deck: SlideDeck,
  slideId: string,
  targetIndex: number
): SlideDeck => {
  const sourceIndex = deck.slides.findIndex((slide) => slide.id === slideId);
  if (sourceIndex < 0 || !Number.isFinite(targetIndex)) return deck;
  const clampedIndex = Math.min(
    deck.slides.length - 1,
    Math.max(0, Math.trunc(targetIndex))
  );
  if (sourceIndex === clampedIndex) return deck;

  const slides = [...deck.slides];
  const [slide] = slides.splice(sourceIndex, 1);
  slides.splice(clampedIndex, 0, slide);
  return { ...deck, slides };
};

export const updateSlideGrid = (
  deck: SlideDeck,
  slideId: string,
  grid: ReadonlyArray<readonly [string, GridCell]>
): SlideDeck => {
  if (!hasSlide(deck, slideId)) return deck;
  return {
    ...deck,
    slides: deck.slides.map((slide) =>
      slide.id === slideId
        ? { ...slide, grid: normalizeSlideGridEntries(grid, deck.size) }
        : slide
    ),
  };
};
