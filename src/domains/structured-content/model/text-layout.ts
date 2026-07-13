import type { GridCell, Point } from "@/shared/types";
import type { StructuredNodeStyle } from "./types";
import { normalizeCellStyle } from "@/shared/utils/ansi";
import { getCellOccupancy, splitGraphemes } from "@/shared/metrics";

type TextLayoutRun = {
  char: string;
  offset: number;
  x: number;
  y: number;
  width: number;
  line: number;
  column: number;
};

type TextSelectionRect = {
  point: Point;
  width: number;
};

type TextSurfaceCell = GridCell & {
  x: number;
  y: number;
  offset: number;
  follower?: true;
};

type TextLayout = {
  text: string;
  origin: Point;
  runs: TextLayoutRun[];
  lineWidths: number[];
  lineStarts: number[];
  length: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const createTextLayout = (text: string, origin: Point): TextLayout => {
  const chars = splitGraphemes(text);
  const runs: TextLayoutRun[] = [];
  const lineWidths: number[] = [0];
  const lineStarts: number[] = [0];
  let x = origin.x;
  let y = origin.y;
  let line = 0;
  let column = 0;

  chars.forEach((char, offset) => {
    if (char === "\n") {
      lineWidths[line] = column;
      line += 1;
      lineStarts[line] = offset + 1;
      lineWidths[line] = 0;
      x = origin.x;
      y += 1;
      column = 0;
      return;
    }

    const width = getCellOccupancy(char);
    runs.push({ char, offset, x, y, width, line, column });
    x += width;
    column += width;
    lineWidths[line] = column;
  });

  return {
    text,
    origin: { ...origin },
    runs,
    lineWidths,
    lineStarts,
    length: chars.length,
  };
};

export const getTextLayoutOffsetAtPoint = (
  layout: TextLayout,
  point: Point
) => {
  const line = clamp(point.y - layout.origin.y, 0, layout.lineStarts.length - 1);
  const lineStart = layout.lineStarts[line] ?? layout.length;
  const lineEnd =
    line + 1 < layout.lineStarts.length
      ? Math.max(lineStart, layout.lineStarts[line + 1] - 1)
      : layout.length;
  const column = Math.max(0, point.x - layout.origin.x);
  const lineRuns = layout.runs.filter((run) => run.line === line);

  for (const run of lineRuns) {
    if (run.column + run.width / 2 >= column) return run.offset;
  }

  return lineEnd;
};

export const getTextLayoutCaretPoint = (
  layout: TextLayout,
  offset: number
): Point => {
  const target = clamp(offset, 0, layout.length);
  if (target === 0) return { ...layout.origin };

  const line = layout.lineStarts.findIndex((start) => start === target);
  if (line >= 0) {
    return { x: layout.origin.x, y: layout.origin.y + line };
  }

  const previousRun = [...layout.runs]
    .reverse()
    .find((run) => run.offset < target);
  if (previousRun) {
    return {
      x: previousRun.x + previousRun.width,
      y: previousRun.y,
    };
  }

  return { ...layout.origin };
};

export const getTextLayoutSelectionRects = (
  layout: TextLayout,
  start: number,
  end: number
): TextSelectionRect[] => {
  const rangeStart = clamp(Math.min(start, end), 0, layout.length);
  const rangeEnd = clamp(Math.max(start, end), rangeStart, layout.length);
  return layout.runs
    .filter((run) => run.offset >= rangeStart && run.offset < rangeEnd)
    .map((run) => ({
      point: { x: run.x, y: run.y },
      width: run.width,
    }));
};

export const getTextLayoutSurfaceCells = (
  layout: TextLayout,
  styleForOffset: (offset: number) => StructuredNodeStyle
): TextSurfaceCell[] => {
  const cells: TextSurfaceCell[] = [];
  layout.runs.forEach((run) => {
    const style = styleForOffset(run.offset);
    cells.push({
      x: run.x,
      y: run.y,
      offset: run.offset,
      ...normalizeCellStyle({ char: run.char, ...style }),
    });
    for (let follower = 1; follower < run.width; follower += 1) {
      cells.push({
        x: run.x + follower,
        y: run.y,
        offset: run.offset,
        follower: true,
        ...normalizeCellStyle({ char: " ", ...style }),
      });
    }
  });
  return cells;
};
