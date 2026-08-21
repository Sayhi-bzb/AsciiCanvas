import { getTextCellWidth } from "@chardesk/protocol";
import { drawMultiBox } from "../vendor/ascii/draw.js";
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
  const canvas = drawMultiBox(sections, useAscii);
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
);
