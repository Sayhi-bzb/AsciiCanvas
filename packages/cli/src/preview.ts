import {
  serializeCharGraphAnsi,
  type CharGraphFragment,
} from "@chardesk/chargraph";
import { CHARDESK_LIGHT_RENDER_THEME } from "@chardesk/chargraph/theme";
import type {
  CharDeskTextAttributes,
  CharDeskTextCell,
  ParsedCharDeskText,
} from "@chardesk/protocol";
import type { CharDeskResultRegion } from "./result.js";

type CharDeskPreviewProjection = {
  text: string;
  view: CharDeskResultRegion;
  omitted: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
};

type PreviewOptions = {
  region?: CharDeskResultRegion;
  maximumColumns: number;
  maximumRows: number;
  color: boolean;
};

const sameAttributes = (
  left?: CharDeskTextAttributes,
  right?: CharDeskTextAttributes,
) => (
  left?.bold === right?.bold
  && left?.italic === right?.italic
  && left?.underline === right?.underline
  && left?.strike === right?.strike
  && left?.inverse === right?.inverse
);

const appendFragment = (
  fragments: CharGraphFragment[],
  fragment: CharGraphFragment,
) => {
  const previous = fragments[fragments.length - 1];
  if (
    previous
    && previous.color === fragment.color
    && previous.bgColor === fragment.bgColor
    && previous.href === fragment.href
    && sameAttributes(previous.attrs, fragment.attrs)
  ) {
    previous.text += fragment.text;
    return;
  }
  fragments.push(fragment);
};

const cellAtBoundary = (
  document: ParsedCharDeskText,
  boundary: number,
) => document.cells.find((cell) => cell.x < boundary && cell.x + cell.width > boundary);

const resolvePreviewView = (
  document: ParsedCharDeskText,
  options: PreviewOptions,
): CharDeskResultRegion => {
  const requested = options.region ?? {
    x: 0,
    y: 0,
    columns: document.width,
    rows: document.height,
  };
  let x = requested.x;
  const leftCell = cellAtBoundary(document, x);
  if (leftCell) x = leftCell.x;
  const columns = Math.min(requested.columns, options.maximumColumns);
  let endX = Math.min(document.width, x + columns);
  const rightCell = cellAtBoundary(document, endX);
  if (rightCell) endX = rightCell.x;
  const endY = Math.min(
    document.height,
    requested.y + Math.min(requested.rows, options.maximumRows),
  );
  return {
    x,
    y: requested.y,
    columns: endX - x,
    rows: endY - requested.y,
  };
};

const rowCells = (
  document: ParsedCharDeskText,
  y: number,
  start: number,
  end: number,
) => document.cells
  .filter((cell) => cell.y === y && cell.x >= start && cell.x + cell.width <= end)
  .sort((left, right) => left.x - right.x);

const plainRow = (
  cells: CharDeskTextCell[],
  start: number,
  end: number,
) => {
  let cursor = start;
  let output = "";
  for (const cell of cells) {
    if (cell.x > cursor) output += " ".repeat(cell.x - cursor);
    output += cell.text;
    cursor = cell.x + cell.width;
  }
  if (cursor < end) output += " ".repeat(end - cursor);
  return output;
};

const ansiRow = (
  cells: CharDeskTextCell[],
  start: number,
  end: number,
) => {
  const fragments: CharGraphFragment[] = [];
  let cursor = start;
  for (const cell of cells) {
    if (cell.x > cursor) {
      appendFragment(fragments, {
        text: " ".repeat(cell.x - cursor),
      });
    }
    appendFragment(fragments, {
      text: cell.text,
      color: cell.color === CHARDESK_LIGHT_RENDER_THEME.foreground
        ? undefined
        : cell.color,
      bgColor: cell.bgColor === CHARDESK_LIGHT_RENDER_THEME.background
        ? undefined
        : cell.bgColor,
      ...(cell.attrs ? { attrs: cell.attrs } : {}),
      ...(cell.href ? { href: cell.href } : {}),
    });
    cursor = cell.x + cell.width;
  }
  if (cursor < end) {
    appendFragment(fragments, {
      text: " ".repeat(end - cursor),
    });
  }
  return serializeCharGraphAnsi({ fragments });
};

export const projectCharDeskPreview = (
  document: ParsedCharDeskText,
  options: PreviewOptions,
): CharDeskPreviewProjection => {
  const view = resolvePreviewView(document, options);
  const endX = view.x + view.columns;
  const endY = view.y + view.rows;
  const rows: string[] = [];
  for (let y = view.y; y < endY; y += 1) {
    const cells = rowCells(document, y, view.x, endX);
    rows.push(options.color
      ? ansiRow(cells, view.x, endX)
      : plainRow(cells, view.x, endX));
  }
  return {
    text: rows.join("\n"),
    view,
    omitted: {
      left: view.x,
      right: document.width - endX,
      top: view.y,
      bottom: document.height - endY,
    },
  };
};
