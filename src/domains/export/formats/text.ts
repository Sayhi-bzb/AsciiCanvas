import { COLOR_PRIMARY_TEXT, EXPORT_PADDING } from "@/shared/lib/constants";
import { getCellOccupancy } from "@/shared/metrics";
import type { AnimationCanvasSize, GridCell, GridMap, SelectionArea } from "@/shared/types";
import {
  cloneTextAttributes,
  effectiveCellStyle,
  isSameTextAttributes,
  parseAnsiHexColor,
  toAnsi16Color,
  toAnsiTruecolor,
} from "@/shared/utils/ansi";
import { GridManager } from "@/shared/utils/grid";
import { getSelectionsBoundingBox } from "@/shared/utils/selection";

const ANSI_RESET = "\u001b[0m";
const ANSI_DEFAULT_FOREGROUND_COLORS = new Set([
  "#000000",
  COLOR_PRIMARY_TEXT.toLowerCase(),
  "#0f172a",
]);
const isAnsiDefaultForeground = (color: string) => {
  const parsedColor = parseAnsiHexColor(color);
  return (
    ANSI_DEFAULT_FOREGROUND_COLORS.has(color.toLowerCase()) ||
    (parsedColor?.red === 0 && parsedColor.green === 0 && parsedColor.blue === 0)
  );
};

type AnsiPiece = {
  char: string;
  cell: GridCell | null;
};

type ActiveAnsiStyle = {
  color: string | null;
  bgColor: string | null;
  attrs?: GridCell["attrs"];
  href?: string;
};

const buildAnsiPiecesFromBounds = (
  grid: GridMap,
  minX: number,
  maxX: number,
  y: number,
  options?: {
    includeColor?: boolean;
  }
) => {
  const pieces: AnsiPiece[] = [];

  for (let x = minX; x <= maxX; x++) {
    const cell = grid.get(GridManager.toKey(x, y));
    if (cell) {
      pieces.push({
        char: cell.char,
        cell: options?.includeColor === false ? null : cell,
      });
      if (getCellOccupancy(cell.char) === 2) x++;
      continue;
    }
    pieces.push({ char: " ", cell: null });
  }

  return pieces;
};

const resolveAnsiPieceStyle = (piece: AnsiPiece): ActiveAnsiStyle => {
  if (!piece.cell) return { color: null, bgColor: null };
  const style = effectiveCellStyle(piece.cell);
  const color =
    parseAnsiHexColor(style.color) && !isAnsiDefaultForeground(style.color)
      ? style.color
      : null;
  return {
    color,
    bgColor: style.bgColor && parseAnsiHexColor(style.bgColor) ? style.bgColor : null,
    attrs: style.attrs,
    ...(piece.cell.href ? { href: piece.cell.href } : {}),
  };
};

const isAnsiSignificantPiece = (piece: AnsiPiece) => {
  if (piece.char !== " ") return true;
  if (!piece.cell) return false;
  const style = resolveAnsiPieceStyle(piece);
  return (
    !!style.color ||
    !!style.bgColor ||
    !!style.href ||
    !!cloneTextAttributes(style.attrs)
  );
};

const trimTrailingAnsiSpaces = (pieces: AnsiPiece[]) => {
  let end = pieces.length;
  while (end > 0 && !isAnsiSignificantPiece(pieces[end - 1])) {
    end -= 1;
  }
  return pieces.slice(0, end);
};

const sameAnsiStyle = (a: ActiveAnsiStyle, b: ActiveAnsiStyle) => {
  return (
    a.color === b.color &&
    a.bgColor === b.bgColor &&
    a.href === b.href &&
    isSameTextAttributes(a.attrs, b.attrs)
  );
};

const toAnsiStyleSequence = (style: ActiveAnsiStyle) => {
  const codes: string[] = [];
  if (style.attrs?.bold) codes.push("1");
  if (style.attrs?.italic) codes.push("3");
  if (style.attrs?.underline) codes.push("4");
  if (style.attrs?.inverse) codes.push("7");
  if (style.attrs?.strike) codes.push("9");
  const foreground = style.color
    ? toAnsi16Color(38, style.color) ?? toAnsiTruecolor(38, style.color)
    : null;
  const background = style.bgColor
    ? toAnsi16Color(48, style.bgColor) ?? toAnsiTruecolor(48, style.bgColor)
    : null;
  if (foreground) codes.push(foreground);
  if (background) codes.push(background);
  return codes.length > 0 ? `\u001b[${codes.join(";")}m` : "";
};

const toHyperlinkSequence = (href: string) => `]8;;${href}\\`;
const closeHyperlinkSequence = () => "]8;;\\";

const serializeAnsiLine = (pieces: AnsiPiece[]) => {
  if (pieces.length === 0) return "";

  let out = "";
  let activeStyle: ActiveAnsiStyle = { color: null, bgColor: null };

  pieces.forEach((piece) => {
    const nextStyle = resolveAnsiPieceStyle(piece);
    if (!sameAnsiStyle(activeStyle, nextStyle)) {
      if (activeStyle.href && activeStyle.href !== nextStyle.href) {
        out += closeHyperlinkSequence();
      }
      if (!sameAnsiStyle(activeStyle, { color: null, bgColor: null })) {
        out += ANSI_RESET;
      }
      if (nextStyle.href && activeStyle.href !== nextStyle.href) {
        out += toHyperlinkSequence(nextStyle.href);
      }
      out += toAnsiStyleSequence(nextStyle);
      activeStyle = nextStyle;
    }
    if (!piece.cell) {
      out += piece.char;
      return;
    }

    out += piece.char;
  });

  return sameAnsiStyle(activeStyle, { color: null, bgColor: null })
    ? out
    : `${out}${ANSI_RESET}`;
};

const generateStringFromBounds = (
  grid: GridMap,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number
): string => {
  const lines: string[] = [];

  for (let y = minY; y <= maxY; y++) {
    let line = "";
    for (let x = minX; x <= maxX; x++) {
      const cell = grid.get(GridManager.toKey(x, y));
      if (cell) {
        line += cell.char;
        if (getCellOccupancy(cell.char) === 2) x++;
      } else {
        line += " ";
      }
    }
    lines.push(line.replace(/\s+$/, ""));
  }
  return lines.join("\n");
};

export const exportToString = (grid: GridMap) => {
  if (grid.size === 0) return "";
  const { minX, maxX, minY, maxY } = GridManager.getGridBounds(grid);

  return generateStringFromBounds(
    grid,
    minX - EXPORT_PADDING,
    maxX + EXPORT_PADDING,
    minY - EXPORT_PADDING,
    maxY + EXPORT_PADDING
  );
};

export const exportSelectionToString = (
  grid: GridMap,
  selections: SelectionArea[]
) => {
  if (selections.length === 0) return "";
  const { minX, maxX, minY, maxY } = getSelectionsBoundingBox(selections);
  return generateStringFromBounds(grid, minX, maxX, minY, maxY);
};

export const exportSelectionToAnsi = (
  grid: GridMap,
  selections: SelectionArea[],
  options?: {
    includeColor?: boolean;
  }
) => {
  if (selections.length === 0) return "";
  const { minX, maxX, minY, maxY } = getSelectionsBoundingBox(selections);
  const lines: string[] = [];

  for (let y = minY; y <= maxY; y++) {
    const pieces = trimTrailingAnsiSpaces(
      buildAnsiPiecesFromBounds(grid, minX, maxX, y, options)
    );
    lines.push(serializeAnsiLine(pieces));
  }

  return lines.join("\n");
};

export const exportToAnsi = (
  grid: GridMap,
  options?: {
    includeColor?: boolean;
  }
) => {
  if (grid.size === 0) return "";

  const { minX, maxX, minY, maxY } = GridManager.getGridBounds(grid);
  const lines: string[] = [];

  for (let y = minY; y <= maxY; y++) {
    const pieces = trimTrailingAnsiSpaces(
      buildAnsiPiecesFromBounds(grid, minX, maxX, y, options)
    );
    lines.push(serializeAnsiLine(pieces));
  }

  return lines.join("\n");
};

export const exportAnimationFrameToAnsi = (
  size: AnimationCanvasSize,
  frameGrid: [string, GridCell][],
  options?: {
    includeColor?: boolean;
  }
) => {
  const grid = new Map(frameGrid);
  const lines: string[] = [];

  for (let y = 0; y < size.height; y++) {
    const pieces = buildAnsiPiecesFromBounds(
      grid,
      0,
      size.width - 1,
      y,
      options
    );
    lines.push(serializeAnsiLine(pieces));
  }

  return lines.join("\n");
};

export const exportSelectionToJSON = (
  grid: GridMap,
  selections: SelectionArea[]
) => {
  if (selections.length === 0) return null;
  const { minX, minY, maxX, maxY } = getSelectionsBoundingBox(selections);

  const cells: { x: number; y: number; char: string; color: string }[] = [];

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const cell = grid.get(GridManager.toKey(x, y));
      if (cell) {
        cells.push({
          x: x - minX,
          y: y - minY,
          char: cell.char,
          color: cell.color,
          ...(cell.bgColor ? { bgColor: cell.bgColor } : {}),
          ...(cloneTextAttributes(cell.attrs)
            ? { attrs: cloneTextAttributes(cell.attrs) }
            : {}),
          ...(cell.href ? { href: cell.href } : {}),
        });
      }
    }
  }

  return JSON.stringify({
    type: "ascii-metropolis-zone",
    version: 1,
    cells,
  });
};

