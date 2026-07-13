import {
  BACKGROUND_COLOR,
  GRID_COLOR,
  COLOR_PRIMARY_TEXT,
} from "@/shared/lib/constants";
import type { GridCell } from "@/shared/types";
import type { AnimationCanvasSize, AnimationTimeline } from "@/domains/animation/public";
import {
  DEFAULT_GRID_RENDER_METRICS,
  drawGridLines,
  drawTextCell,
  setTextRenderStyle,
  waitForRenderFont,
} from "@/shared/metrics";

const MONOCHROME_EXPORT_COLOR = COLOR_PRIMARY_TEXT;
const GIF_GLOBAL_COLOR_COUNT = 256;
const GIF_PALETTE_COMPONENTS = 3;
const resolveExportColor = (color: string, includeColor: boolean) => {
  return includeColor ? color : MONOCHROME_EXPORT_COLOR;
};

const waitForExportFont = waitForRenderFont;

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

export const createAnimationGifBlob = async (
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

  return new Blob([new Uint8Array(bytes)], { type: "image/gif" });
};

