import {
  EXPORT_PADDING,
  BACKGROUND_COLOR,
  GRID_COLOR,
  COLOR_PRIMARY_TEXT,
} from "@/shared/lib/constants";
import type {
  AnimationCanvasSize,
  AnimationTimeline,
  CanvasMode,
  GridCell,
  GridMap,
  SelectionArea,
  StructuredNode,
} from "@/shared/types";
import { buildProtocolDocumentFromCanvasState } from "@/domains/protocol";
import type { AsciiCanvasDocumentV1 } from "@/domains/protocol";
import { GridManager } from "@/shared/utils/grid";
import { getSelectionsBoundingBox } from "@/shared/utils/selection";
import { clipboard } from "@/shared/services/effects";
import { buildStructuredTree, getStructuredNodeBounds } from "@/shared/utils/structured";
import {
  DEFAULT_GRID_RENDER_METRICS,
  drawGridLines,
  drawTextCell,
  getCellOccupancy,
  setTextRenderStyle,
  waitForRenderFont,
} from "@/shared/metrics";
import {
  cloneTextAttributes,
  effectiveCellStyle,
  isSameTextAttributes,
  parseAnsiHexColor,
  toAnsiTruecolor,
} from "@/shared/utils/ansi";

type AnimationExchangeCell = {
  x: number;
  y: number;
  char: string;
  color: string;
  bgColor?: string;
  attrs?: GridCell["attrs"];
  href?: string;
};

type AnimationExchangeDocument = {
  type: "ascii-animation";
  version: 1;
  size: AnimationCanvasSize;
  playback: {
    fps: number;
    loop: boolean;
  };
  frames: Array<{
    name: string;
    cells: AnimationExchangeCell[];
  }>;
};

interface ProtocolExportInput {
  canvasMode: CanvasMode;
  grid: GridMap;
  structuredScene: StructuredNode[];
  canvasBounds: AnimationCanvasSize | null;
  animationTimeline: AnimationTimeline | null;
  includeColor?: boolean;
}

const GIF_GLOBAL_COLOR_COUNT = 256;
const GIF_PALETTE_COMPONENTS = 3;
const ANSI_RESET = "\u001b[0m";
const ANSI_DEFAULT_FOREGROUND_COLORS = new Set([
  "#000000",
  COLOR_PRIMARY_TEXT.toLowerCase(),
  "#0f172a",
]);
const MONOCHROME_EXPORT_COLOR = COLOR_PRIMARY_TEXT;

const resolveExportColor = (color: string, includeColor: boolean) => {
  return includeColor ? color : MONOCHROME_EXPORT_COLOR;
};

const waitForExportFont = waitForRenderFont;

const applyMonochromeProtocolColor = (
  document: AsciiCanvasDocumentV1
): AsciiCanvasDocumentV1 => {
  switch (document.mode) {
    case "freeform":
      return {
        ...document,
        cells: document.cells.map((cell) => ({
          x: cell.x,
          y: cell.y,
          char: cell.char,
          color: MONOCHROME_EXPORT_COLOR,
        })),
      };
    case "animation":
      return {
        ...document,
        frames: document.frames.map((frame) => ({
          ...frame,
          cells: frame.cells.map((cell) => ({
            x: cell.x,
            y: cell.y,
            char: cell.char,
            color: MONOCHROME_EXPORT_COLOR,
          })),
        })),
      };
    case "structured":
      return {
        ...document,
        nodes: document.nodes.map((node) => ({
          ...node,
          style: {
            color: MONOCHROME_EXPORT_COLOR,
          },
        })),
      };
  }
};

const renderAnimationFrame = (
  ctx: CanvasRenderingContext2D,
  size: AnimationCanvasSize,
  frameGrid: [string, GridCell][],
  options?: {
    showGrid?: boolean;
    includeColor?: boolean;
  }
) => {
  const { cellWidth, cellHeight } = DEFAULT_GRID_RENDER_METRICS;
  const width = size.width * cellWidth;
  const height = size.height * cellHeight;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, width, height);

  if (options?.showGrid) {
    drawGridLines(ctx, {
      startX: 0,
      endX: size.width,
      startY: 0,
      endY: size.height,
      width,
      height,
      color: GRID_COLOR,
      lineWidth: 0.5,
    });
  }

  setTextRenderStyle(ctx);

  frameGrid.forEach(([key, cell]) => {
    const [x, y] = key.split(",").map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const drawX = x * cellWidth;
    const drawY = y * cellHeight;
    drawTextCell(ctx, cell, drawX, drawY, {
      color: resolveExportColor(cell.color, options?.includeColor !== false),
    });
  });
};

const buildGifPalette = () => {
  const palette = new Uint8Array(GIF_GLOBAL_COLOR_COUNT * GIF_PALETTE_COMPONENTS);

  for (let index = 0; index < GIF_GLOBAL_COLOR_COUNT; index++) {
    const red = (index >> 5) & 0x07;
    const green = (index >> 2) & 0x07;
    const blue = index & 0x03;

    palette[index * 3] = Math.round((red / 7) * 255);
    palette[index * 3 + 1] = Math.round((green / 7) * 255);
    palette[index * 3 + 2] = Math.round((blue / 3) * 255);
  }

  return palette;
};

const quantizeToGifIndex = (red: number, green: number, blue: number) => {
  return ((red & 0xe0) | ((green & 0xe0) >> 3) | (blue >> 6)) & 0xff;
};

const imageDataToGifIndices = (imageData: ImageData) => {
  const pixels = new Uint8Array(imageData.width * imageData.height);

  for (let src = 0, dest = 0; src < imageData.data.length; src += 4, dest += 1) {
    pixels[dest] = quantizeToGifIndex(
      imageData.data[src],
      imageData.data[src + 1],
      imageData.data[src + 2]
    );
  }

  return pixels;
};

const lzwEncodeGif = (indices: Uint8Array, minimumCodeSize = 8) => {
  const clearCode = 1 << minimumCodeSize;
  const endOfInformationCode = clearCode + 1;
  const resetDictionary = () => {
    const next = new Map<string, number>();
    for (let i = 0; i < clearCode; i++) {
      next.set(String(i), i);
    }
    return next;
  };

  const bytes: number[] = [];
  let buffer = 0;
  let bitCount = 0;
  let dictionary = resetDictionary();
  let nextCode = endOfInformationCode + 1;
  let codeSize = minimumCodeSize + 1;

  const writeCode = (code: number) => {
    buffer |= code << bitCount;
    bitCount += codeSize;

    while (bitCount >= 8) {
      bytes.push(buffer & 0xff);
      buffer >>= 8;
      bitCount -= 8;
    }
  };

  writeCode(clearCode);
  let sequence = String(indices[0] ?? 0);

  for (let i = 1; i < indices.length; i++) {
    const symbol = String(indices[i]);
    const combined = `${sequence},${symbol}`;

    if (dictionary.has(combined)) {
      sequence = combined;
      continue;
    }

    writeCode(dictionary.get(sequence)!);

    if (nextCode <= 4095) {
      dictionary.set(combined, nextCode);
      nextCode += 1;
      if (nextCode > 1 << codeSize && codeSize < 12) {
        codeSize += 1;
      }
    } else {
      writeCode(clearCode);
      dictionary = resetDictionary();
      nextCode = endOfInformationCode + 1;
      codeSize = minimumCodeSize + 1;
    }

    sequence = symbol;
  }

  writeCode(dictionary.get(sequence)!);
  writeCode(endOfInformationCode);

  if (bitCount > 0) {
    bytes.push(buffer & 0xff);
  }

  const blocks: number[] = [minimumCodeSize];

  for (let index = 0; index < bytes.length; index += 255) {
    const chunk = bytes.slice(index, index + 255);
    blocks.push(chunk.length, ...chunk);
  }

  blocks.push(0);
  return blocks;
};

const pushUint16 = (target: number[], value: number) => {
  target.push(value & 0xff, (value >> 8) & 0xff);
};

const pushAscii = (target: number[], value: string) => {
  value.split("").forEach((char) => target.push(char.charCodeAt(0)));
};

const downloadBlob = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
};

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

const trimTrailingAnsiSpaces = (pieces: AnsiPiece[]) => {
  let end = pieces.length;
  while (end > 0 && pieces[end - 1].char === " ") {
    end -= 1;
  }
  return pieces.slice(0, end);
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
  const foreground = style.color ? toAnsiTruecolor(38, style.color) : null;
  const background = style.bgColor ? toAnsiTruecolor(48, style.bgColor) : null;
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

export const copySelectionToPngClipboard = async (
  grid: GridMap,
  selections: SelectionArea[],
  showGrid: boolean = true,
  includeColor: boolean = true
) => {
  if (selections.length === 0) return;
  await waitForExportFont();

  const { minX, maxX, minY, maxY } = getSelectionsBoundingBox(selections);
  const padding = 1;

  const cols = maxX - minX + 1 + padding * 2;
  const rows = maxY - minY + 1 + padding * 2;

  const { cellWidth, cellHeight } = DEFAULT_GRID_RENDER_METRICS;
  const width = cols * cellWidth;
  const height = rows * cellHeight;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = 2;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, width, height);

  if (showGrid) {
    drawGridLines(ctx, {
      startX: 0,
      endX: cols,
      startY: 0,
      endY: rows,
      width,
      height,
      color: GRID_COLOR,
    });
  }

  setTextRenderStyle(ctx);

  for (let y = minY - padding; y <= maxY + padding; y++) {
    for (let x = minX - padding; x <= maxX + padding; x++) {
      const cell = grid.get(GridManager.toKey(x, y));
      if (!cell) continue;

      const drawX = (x - (minX - padding)) * cellWidth;
      const drawY = (y - (minY - padding)) * cellHeight;
      drawTextCell(ctx, cell, drawX, drawY, {
        color: resolveExportColor(cell.color, includeColor),
      });
    }
  }

  try {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png", 1.0)
    );

    if (blob) {
      const copied = await clipboard.writeItems([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      if (!copied) {
        throw new Error("Unable to write PNG to clipboard");
      }
    }
  } catch (err) {
    console.error("Failed to copy image to clipboard", err);
    throw err;
  }
};

const createPngBlobFromGrid = async (
  grid: GridMap,
  showGrid: boolean = false,
  includeColor: boolean = true
) => {
  if (grid.size === 0) return null;
  await waitForExportFont();
  const { minX, maxX, minY, maxY } = GridManager.getGridBounds(grid);
  const padding = 2;
  const { cellWidth, cellHeight } = DEFAULT_GRID_RENDER_METRICS;
  const width = (maxX - minX + 1 + padding * 2) * cellWidth;
  const height = (maxY - minY + 1 + padding * 2) * cellHeight;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const dpr = 2;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, width, height);

  if (showGrid) {
    const gridWidth = maxX - minX + 1 + padding * 2;
    const gridHeight = maxY - minY + 1 + padding * 2;
    drawGridLines(ctx, {
      startX: 0,
      endX: gridWidth,
      startY: 0,
      endY: gridHeight,
      width,
      height,
      color: GRID_COLOR,
      lineWidth: 0.5,
    });
  }

  setTextRenderStyle(ctx);

  GridManager.iterate(grid, (cell, x, y) => {
    const drawX = (x - minX + padding) * cellWidth;
    const drawY = (y - minY + padding) * cellHeight;
    drawTextCell(ctx, cell, drawX, drawY, {
      color: resolveExportColor(cell.color, includeColor),
    });
  });

  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png", 1.0)
  );
};

export const copyCanvasToPngClipboard = async (
  grid: GridMap,
  showGrid: boolean = false,
  includeColor: boolean = true
) => {
  const blob = await createPngBlobFromGrid(grid, showGrid, includeColor);
  if (!blob) return false;
  return clipboard.writeItems([new ClipboardItem({ [blob.type]: blob })]);
};

export const exportToPNG = async (
  grid: GridMap,
  showGrid: boolean = false,
  includeColor: boolean = true
) => {
  if (grid.size === 0) return false;
  await waitForExportFont();
  const { minX, maxX, minY, maxY } = GridManager.getGridBounds(grid);
  const padding = 2;
  const { cellWidth, cellHeight } = DEFAULT_GRID_RENDER_METRICS;
  const width = (maxX - minX + 1 + padding * 2) * cellWidth;
  const height = (maxY - minY + 1 + padding * 2) * cellHeight;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  const dpr = 2;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, width, height);

  if (showGrid) {
    const gridWidth = maxX - minX + 1 + padding * 2;
    const gridHeight = maxY - minY + 1 + padding * 2;
    drawGridLines(ctx, {
      startX: 0,
      endX: gridWidth,
      startY: 0,
      endY: gridHeight,
      width,
      height,
      color: GRID_COLOR,
      lineWidth: 0.5,
    });
  }

  setTextRenderStyle(ctx);

  GridManager.iterate(grid, (cell, x, y) => {
    const drawX = (x - minX + padding) * cellWidth;
    const drawY = (y - minY + padding) * cellHeight;
    drawTextCell(ctx, cell, drawX, drawY, {
      color: resolveExportColor(cell.color, includeColor),
    });
  });

  const link = document.createElement("a");
  link.download = `ascii-city-${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  return true;
};

export const buildAnimationExchangeDocument = (
  size: AnimationCanvasSize,
  timeline: AnimationTimeline
): AnimationExchangeDocument => {
  return {
    type: "ascii-animation",
    version: 1,
    size,
    playback: {
      fps: timeline.fps,
      loop: timeline.loop,
    },
    frames: timeline.frames.map((frame) => ({
      name: frame.name,
      cells: frame.grid.map(([key, cell]) => {
        const [x, y] = key.split(",").map(Number);
        return {
          x,
          y,
          char: cell.char,
          color: cell.color,
          ...(cell.bgColor ? { bgColor: cell.bgColor } : {}),
          ...(cloneTextAttributes(cell.attrs)
            ? { attrs: cloneTextAttributes(cell.attrs) }
            : {}),
          ...(cell.href ? { href: cell.href } : {}),
        };
      }),
    })),
  };
};

export const buildProtocolExportDocument = ({
  canvasMode,
  grid,
  structuredScene,
  canvasBounds,
  animationTimeline,
  includeColor = true,
}: ProtocolExportInput) => {
  const document = buildProtocolDocumentFromCanvasState({
    canvasMode,
    grid,
    structuredScene,
    canvasBounds,
    animationTimeline,
  });
  return includeColor ? document : applyMonochromeProtocolColor(document);
};

export const exportProtocolToJSON = (input: ProtocolExportInput) => {
  return JSON.stringify(buildProtocolExportDocument(input), null, 2);
};

export const exportAnimationToJSON = (
  size: AnimationCanvasSize,
  timeline: AnimationTimeline
) => {
  return JSON.stringify(buildAnimationExchangeDocument(size, timeline), null, 2);
};

export const exportAnimationToGIF = async (
  size: AnimationCanvasSize,
  timeline: AnimationTimeline,
  includeColor: boolean = true
) => {
  await waitForExportFont();
  const { cellWidth, cellHeight } = DEFAULT_GRID_RENDER_METRICS;
  const width = Math.max(1, Math.round(size.width * cellWidth));
  const height = Math.max(1, Math.round(size.height * cellHeight));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;

  const bytes: number[] = [];
  const palette = buildGifPalette();
  const delay = Math.max(1, Math.round(100 / Math.max(timeline.fps, 1)));

  pushAscii(bytes, "GIF89a");
  pushUint16(bytes, width);
  pushUint16(bytes, height);
  bytes.push(0xf7, 0xff, 0x00, ...palette);

  if (timeline.loop) {
    bytes.push(
      0x21,
      0xff,
      0x0b,
      0x4e,
      0x45,
      0x54,
      0x53,
      0x43,
      0x41,
      0x50,
      0x45,
      0x32,
      0x2e,
      0x30,
      0x03,
      0x01,
      0x00,
      0x00,
      0x00
    );
  }

  timeline.frames.forEach((frame) => {
    renderAnimationFrame(ctx, size, frame.grid, { includeColor });
    const indices = imageDataToGifIndices(ctx.getImageData(0, 0, width, height));

    bytes.push(0x21, 0xf9, 0x04, 0x00);
    pushUint16(bytes, delay);
    bytes.push(0x00, 0x00);

    bytes.push(0x2c);
    pushUint16(bytes, 0);
    pushUint16(bytes, 0);
    pushUint16(bytes, width);
    pushUint16(bytes, height);
    bytes.push(0x00, ...lzwEncodeGif(indices));
  });

  bytes.push(0x3b);

  const blob = new Blob([new Uint8Array(bytes)], { type: "image/gif" });
  return downloadBlob(`ascii-animation-${Date.now()}.gif`, blob);
};

export const downloadTextFile = (
  filename: string,
  content: string,
  mimeType = "application/json;charset=utf-8"
) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
};

const escapeAttr = (value: string) => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
};

const formatBounds = (node: StructuredNode) => {
  const bounds = getStructuredNodeBounds(node);
  return `${bounds.x},${bounds.y},${bounds.width},${bounds.height}`;
};

const formatStyle = (style: StructuredNode["style"]) => {
  const parts = [`color:${escapeAttr(style.color)}`];
  if (style.bgColor) parts.push(`bgColor:${escapeAttr(style.bgColor)}`);
  const attrs = cloneTextAttributes(style.attrs);
  if (attrs) {
    parts.push(
      `attrs:${Object.keys(attrs)
        .filter((key) => attrs[key as keyof typeof attrs])
        .join(",")}`
    );
  }
  return parts.join(";");
};

const emitTag = (
  lines: string[],
  tag: string,
  attrs: Array<[string, string]>,
  indent: string,
  selfClose: boolean
) => {
  lines.push(`${indent}<${tag}`);
  attrs.forEach(([name, value]) => {
    lines.push(`${indent}  ${name}="${value}"`);
  });
  lines.push(`${indent}${selfClose ? "/>" : ">"}`);
};

export const exportStructuredF12Text = (scene: StructuredNode[]) => {
  const { roots, childrenById } = buildStructuredTree(scene);
  const lines: string[] = [];

  const emitNode = (node: StructuredNode, depth: number) => {
    const indent = "  ".repeat(depth);
    const commonAttrs: Array<[string, string]> = [
      ["id", escapeAttr(node.id)],
      ["bounds", formatBounds(node)],
      ["style", formatStyle(node.style)],
    ];

    if (node.type === "box") {
      const boxAttrs =
        node.name && node.name.trim()
          ? [...commonAttrs, ["name", escapeAttr(node.name)] as [string, string]]
          : commonAttrs;
      emitTag(lines, "box", boxAttrs, indent, false);
      const children = childrenById.get(node.id) || [];
      children.forEach((child) => emitNode(child, depth + 1));
      lines.push(`${indent}</box>`);
      return;
    }

    if (node.type === "line") {
      emitTag(
        lines,
        "line",
        [
          ...commonAttrs,
          ["from", `${node.start.x},${node.start.y}`],
          ["to", `${node.end.x},${node.end.y}`],
          ["axis", node.axis],
        ],
        indent,
        true
      );
      return;
    }

    emitTag(
      lines,
      "text",
      [
        ...commonAttrs,
        ["at", `${node.position.x},${node.position.y}`],
        ["text", escapeAttr(node.text)],
      ],
      indent,
      true
    );
  };

  emitTag(
    lines,
    "canvas",
    [
      ["mode", "structured"],
      ["nodes", String(scene.length)],
    ],
    "",
    false
  );
  roots.forEach((node) => emitNode(node, 1));
  lines.push("</canvas>");
  return lines.join("\n");
};
