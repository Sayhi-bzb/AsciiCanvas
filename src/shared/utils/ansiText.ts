import { getCellOccupancy, splitGraphemes } from "@/shared/metrics";
import type { GridCell } from "@/shared/types";
import {
  parseSgrSequenceAt,
  styleStateToCell,
  type AnsiStyleState,
} from "./ansi";

const DEFAULT_ANSI_TEXT_COLOR = "#ffffff";

export type AnsiTextCell = GridCell & {
  x: number;
  y: number;
};

export const parseAnsiTextCells = (
  input: string,
  defaultColor = DEFAULT_ANSI_TEXT_COLOR
): AnsiTextCell[] | null => {
  if (!input) return null;

  const cells: AnsiTextCell[] = [];
  let x = 0;
  let y = 0;
  let index = 0;
  const defaultStyle: AnsiStyleState = { color: defaultColor };
  let currentStyle: AnsiStyleState = { color: defaultColor };
  let sawSgrSequence = false;

  while (index < input.length) {
    const sequence = parseSgrSequenceAt(
      input,
      index,
      currentStyle,
      defaultStyle,
      true
    );
    if (sequence) {
      currentStyle = sequence.style;
      sawSgrSequence ||= sequence.changed;
      index = sequence.nextIndex;
      continue;
    }

    if (input[index] === "\r" && input[index + 1] === "\n") {
      x = 0;
      y += 1;
      index += 2;
      continue;
    }
    if (input[index] === "\n" || input[index] === "\r") {
      x = 0;
      y += 1;
      index += 1;
      continue;
    }

    const char = splitGraphemes(input.slice(index))[0] ?? input[index];
    cells.push({ x, y, ...styleStateToCell(char, currentStyle) });
    x += getCellOccupancy(char);
    index += char.length;
  }

  return sawSgrSequence && cells.length > 0 ? cells : null;
};
