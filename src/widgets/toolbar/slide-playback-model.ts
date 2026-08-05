import { CELL_HEIGHT, CELL_WIDTH } from "@/shared/lib/constants";

const PAGE_PADDING = 32;

export type SlidePlaybackLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
};

export const resolveSlidePlaybackLayout = ({
  viewportWidth,
  viewportHeight,
  columns,
  rows,
  padding = PAGE_PADDING,
}: {
  viewportWidth: number;
  viewportHeight: number;
  columns: number;
  rows: number;
  padding?: number;
}): SlidePlaybackLayout => {
  const availableWidth = Math.max(1, viewportWidth - padding * 2);
  const availableHeight = Math.max(1, viewportHeight - padding * 2);
  const zoom = Math.max(
    0.01,
    Math.min(
      availableWidth / (columns * CELL_WIDTH),
      availableHeight / (rows * CELL_HEIGHT)
    )
  );
  const width = columns * CELL_WIDTH * zoom;
  const height = rows * CELL_HEIGHT * zoom;
  return {
    x: (viewportWidth - width) / 2,
    y: (viewportHeight - height) / 2,
    width,
    height,
    zoom,
  };
};

export const resolveSlidePlaybackIndex = (
  currentIndex: number,
  command: "previous" | "next" | "first" | "last",
  slideCount: number
) => {
  if (slideCount <= 0) return 0;
  switch (command) {
    case "first":
      return 0;
    case "last":
      return slideCount - 1;
    case "previous":
      return Math.max(0, currentIndex - 1);
    case "next":
      return Math.min(slideCount - 1, currentIndex + 1);
  }
};
