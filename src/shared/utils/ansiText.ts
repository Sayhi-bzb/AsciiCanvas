import { parseAsciiCanvasText } from "@ascii-canvas/protocol";
import type { GridCell } from "@/shared/types";

const DEFAULT_ANSI_TEXT_COLOR = "#ffffff";

type AnsiTextCell = GridCell & {
  x: number;
  y: number;
};

const MARKDOWN_LINK = /(?<!!)\[([^\]\n]+)\]\(([^)\n]+)\)/g;

const markdownLinksToOsc8 = (input: string) =>
  input.replace(
    MARKDOWN_LINK,
    (_match, label: string, href: string) =>
      `]8;;${href}\\${label}]8;;\\`
  );

export const parseAnsiTextCells = (
  input: string,
  defaultColor = DEFAULT_ANSI_TEXT_COLOR
): AnsiTextCell[] | null => {
  if (!input) return null;
  const parsed = parseAsciiCanvasText(markdownLinksToOsc8(input), {
    defaultStyle: { color: defaultColor },
  });
  if (!parsed.hasAnsi || parsed.cells.length === 0) return null;

  return parsed.cells.map((cell) => ({
    x: cell.x,
    y: cell.y,
    char: cell.text,
    color: cell.color ?? defaultColor,
    ...(cell.bgColor ? { bgColor: cell.bgColor } : {}),
    ...(cell.attrs ? { attrs: { ...cell.attrs } } : {}),
    ...(cell.href ? { href: cell.href } : {}),
  }));
};
