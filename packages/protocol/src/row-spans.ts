import { getGraphemeCellWidth, splitGraphemes } from "./graphemes.js";
import type {
  CharDeskTextAttributes,
  CharDeskTextCell,
  CharDeskTextRow,
  CharDeskTextStyle,
} from "./types.js";

const sameAttributes = (
  left?: CharDeskTextAttributes,
  right?: CharDeskTextAttributes
) =>
  left?.bold === right?.bold &&
  left?.italic === right?.italic &&
  left?.underline === right?.underline &&
  left?.strike === right?.strike &&
  left?.inverse === right?.inverse;

export const appendCharDeskTextSpan = (
  rows: CharDeskTextRow[],
  x: number,
  y: number,
  width: number,
  text: string,
  style: CharDeskTextStyle,
  href?: string
) => {
  let row = rows[rows.length - 1];
  if (!row || row.y !== y) {
    row = { y, spans: [] };
    rows.push(row);
  }
  const previous = row.spans[row.spans.length - 1];
  if (
    previous &&
    previous.x + previous.width === x &&
    previous.color === style.color &&
    previous.bgColor === style.bgColor &&
    previous.href === href &&
    sameAttributes(previous.attrs, style.attrs)
  ) {
    previous.text += text;
    previous.width += width;
    return;
  }
  row.spans.push({
    x,
    width,
    text,
    ...(style.color ? { color: style.color } : {}),
    ...(style.bgColor ? { bgColor: style.bgColor } : {}),
    ...(style.attrs ? { attrs: { ...style.attrs } } : {}),
    ...(href ? { href } : {}),
  });
};

export const materializeCharDeskTextRows = (
  rows: readonly CharDeskTextRow[]
): CharDeskTextCell[] => {
  const cells: CharDeskTextCell[] = [];
  for (const row of rows) {
    for (const span of row.spans) {
      let x = span.x;
      for (const grapheme of splitGraphemes(span.text)) {
        const width = getGraphemeCellWidth(grapheme);
        cells.push({
          x,
          y: row.y,
          width,
          text: grapheme,
          ...(span.color ? { color: span.color } : {}),
          ...(span.bgColor ? { bgColor: span.bgColor } : {}),
          ...(span.attrs ? { attrs: { ...span.attrs } } : {}),
          ...(span.href ? { href: span.href } : {}),
        });
        x += width;
      }
    }
  }
  return cells;
};
