import { getTextCellWidth } from "@chardesk/protocol";
import {
  BoxConnection,
  glyphForBoxConnections,
  glyphForBoxCorner,
} from "../vendor/ascii/box-drawing.js";
import { mkCanvas } from "../vendor/ascii/canvas.js";
import type { CharScene } from "../vendor/ascii/scene.js";
import type { Canvas, CharRole } from "../vendor/ascii/types.js";
import type { GridPoint, LayoutLabel } from "./model.js";
import { writeCanvasFragment } from "./render.js";

export const createLayoutLabel = (
  text: string | undefined,
): LayoutLabel | undefined => {
  if (!text) return undefined;
  const lines = text.split("\n");
  return {
    text,
    width: Math.max(...lines.map(getTextCellWidth), 0),
    height: lines.length,
  };
};

export const createMultiBoxCanvas = (
  sections: string[][],
  useAscii: boolean,
) => {
  const padding = 1;
  const contentWidth = Math.max(
    ...sections.flatMap((section) => section.map((line) => line.length)),
    0,
  );
  const width = contentWidth + 2 * padding + 2;
  const height = sections.reduce(
    (total, section) => total + Math.max(section.length, 1),
    sections.length + 1,
  );
  const glyph = (mask: number) => glyphForBoxConnections(mask, { useAscii });
  const horizontal = glyph(BoxConnection.left | BoxConnection.right);
  const vertical = glyph(BoxConnection.up | BoxConnection.down);
  const canvas = mkCanvas(width - 1, height - 1);

  canvas[0]![0] = glyphForBoxCorner(
    BoxConnection.right | BoxConnection.down,
    { useAscii },
  );
  canvas[width - 1]![0] = glyphForBoxCorner(
    BoxConnection.down | BoxConnection.left,
    { useAscii },
  );
  canvas[0]![height - 1] = glyphForBoxCorner(
    BoxConnection.up | BoxConnection.right,
    { useAscii },
  );
  canvas[width - 1]![height - 1] = glyphForBoxCorner(
    BoxConnection.up | BoxConnection.left,
    { useAscii },
  );
  for (let x = 1; x < width - 1; x += 1) {
    canvas[x]![0] = horizontal;
    canvas[x]![height - 1] = horizontal;
  }
  for (let y = 1; y < height - 1; y += 1) {
    canvas[0]![y] = vertical;
    canvas[width - 1]![y] = vertical;
  }

  let row = 1;
  sections.forEach((section, sectionIndex) => {
    for (const line of section.length > 0 ? section : [""]) {
      for (let index = 0; index < line.length; index += 1) {
        canvas[1 + padding + index]![row] = line[index]!;
      }
      row += 1;
    }
    if (sectionIndex === sections.length - 1) return;
    canvas[0]![row] = glyph(
      BoxConnection.up | BoxConnection.right | BoxConnection.down,
    );
    canvas[width - 1]![row] = glyph(
      BoxConnection.up | BoxConnection.down | BoxConnection.left,
    );
    for (let x = 1; x < width - 1; x += 1) canvas[x]![row] = horizontal;
    row += 1;
  });

  if (!useAscii && canvas.length > 0 && (canvas[0]?.length ?? 0) > 0) {
    const right = canvas.length - 1;
    const bottom = canvas[0]!.length - 1;
    canvas[0]![0] = "╭";
    canvas[right]![0] = "╮";
    canvas[0]![bottom] = "╰";
    canvas[right]![bottom] = "╯";
  }
  return canvas;
};

const classifyMultiBoxCell = (
  x: number,
  y: number,
  char: string,
  canvas: Canvas,
  useAscii: boolean,
): CharRole => {
  if (!useAscii) {
    return /^[┌┐└┘├┤┬┴┼│─╭╮╰╯]$/u.test(char) ? "border" : "text";
  }
  const onVerticalBorder = (x === 0 || x === canvas.length - 1) && char === "|";
  const onHorizontalRule = char === "-" && (
    y === 0 ||
    y === (canvas[0]?.length ?? 1) - 1 ||
    canvas[0]?.[y] === "+"
  );
  const cornerOrJunction = char === "+" && (
    x === 0 || x === canvas.length - 1
  );
  return onVerticalBorder || onHorizontalRule || cornerOrJunction
    ? "border"
    : "text";
};

export const drawMultiBoxFragment = (
  scene: CharScene,
  canvas: Canvas,
  origin: GridPoint,
  owner: string,
  useAscii: boolean,
) => writeCanvasFragment(
  scene,
  canvas,
  origin,
  owner,
  (x, y, char) => classifyMultiBoxCell(x, y, char, canvas, useAscii),
  (x, y, char) => char === " "
    ? "node.background"
    : classifyMultiBoxCell(x, y, char, canvas, useAscii) === "border"
      ? "node.border"
      : "node.text",
);
