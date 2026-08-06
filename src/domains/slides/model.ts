import type { GridCell } from "@/shared/types";

export interface SlideSize {
  columns: number;
  rows: number;
}

export type SlideGridEntry = [string, GridCell];

export interface Slide {
  id: string;
  name: string;
  grid: SlideGridEntry[];
}

export interface SlideDeck {
  size: SlideSize;
  slides: Slide[];
  activeSlideId: string;
}

export const SLIDE_SIZE_PRESETS = {
  widescreen: { columns: 100, rows: 27 },
  classic: { columns: 80, rows: 24 },
} as const satisfies Record<string, SlideSize>;

export const DEFAULT_SLIDE_SIZE: SlideSize = {
  ...SLIDE_SIZE_PRESETS.widescreen,
};
