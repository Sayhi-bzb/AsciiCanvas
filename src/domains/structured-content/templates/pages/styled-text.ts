import type { GridCell } from "@/shared/types";
import type {
  StructuredTextRangeStyle,
  StructuredTextStyleRange,
} from "../../model/types";

export type StyledTextRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type StyledTextCell = Pick<GridCell, "char" | "color" | "bgColor" | "attrs">;

const styleFromCell = (cell: StyledTextCell): StructuredTextRangeStyle => ({
  color: cell.color,
  ...(cell.bgColor ? { bgColor: cell.bgColor } : {}),
  ...(cell.attrs ? { attrs: { ...cell.attrs } } : {}),
});

const stylesEqual = (
  left: StructuredTextRangeStyle,
  right: StructuredTextRangeStyle
) =>
  left.color === right.color &&
  left.bgColor === right.bgColor &&
  !!left.attrs?.bold === !!right.attrs?.bold &&
  !!left.attrs?.italic === !!right.attrs?.italic &&
  !!left.attrs?.underline === !!right.attrs?.underline &&
  !!left.attrs?.strike === !!right.attrs?.strike &&
  !!left.attrs?.inverse === !!right.attrs?.inverse;

export const buildStyledTextRegion = (
  { x, y, width, height }: StyledTextRegion,
  cells: ReadonlyMap<string, StyledTextCell>,
  baseStyle: StructuredTextRangeStyle
) => {
  let text = "";
  let offset = 0;
  let activeRange: StructuredTextStyleRange | null = null;
  const styleRanges: StructuredTextStyleRange[] = [];

  const pushStyle = (style: StructuredTextRangeStyle) => {
    if (stylesEqual(style, baseStyle)) {
      activeRange = null;
      return;
    }
    if (activeRange && stylesEqual(activeRange.style, style)) {
      activeRange.end = offset + 1;
      return;
    }
    activeRange = { start: offset, end: offset + 1, style };
    styleRanges.push(activeRange);
  };

  for (let rowOffset = 0; rowOffset < height; rowOffset += 1) {
    const row = Array.from({ length: width }, (_, columnOffset) => {
      const cell = cells.get(x + columnOffset + "," + (y + rowOffset));
      return {
        char: cell?.char ?? " ",
        style: cell ? styleFromCell(cell) : baseStyle,
      };
    });
    let contentLength = row.length;
    while (
      contentLength > 0 &&
      row[contentLength - 1].char === " " &&
      stylesEqual(row[contentLength - 1].style, baseStyle)
    ) {
      contentLength -= 1;
    }

    row.slice(0, contentLength).forEach(({ char, style }) => {
      text += char;
      pushStyle(style);
      offset += 1;
    });
    activeRange = null;
    if (rowOffset < height - 1) {
      text += "\n";
      offset += 1;
    }
  }

  return { text, styleRanges };
};
