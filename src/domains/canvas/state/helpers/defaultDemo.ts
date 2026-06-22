import demoMarkdown from "../../../../../case/demo.md?raw";
import { GridManager } from "@/shared/utils/grid";
import type { GridCell } from "@/shared/types";
import { parseAnsiTextCells } from "@/shared/utils/ansiText";
import { COLOR_PRIMARY_TEXT } from "@/shared/lib/constants";

export const extractAsciiCodeBlocks = (markdown: string) => {
  const blocks: string[] = [];
  const pattern = /```ascii\s*\r?\n([\s\S]*?)\r?\n```/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(markdown)) !== null) {
    blocks.push(match[1]);
  }

  return blocks;
};

export const buildDefaultDemoGrid = (
  markdown = demoMarkdown
): [string, GridCell][] => {
  const content = extractAsciiCodeBlocks(markdown).join("\n\n");
  const cells = parseAnsiTextCells(content, COLOR_PRIMARY_TEXT) ?? [];
  return cells.map((cell) => [
    GridManager.toKey(cell.x, cell.y),
    {
      char: cell.char,
      color: cell.color,
      ...(cell.bgColor ? { bgColor: cell.bgColor } : {}),
      ...(cell.attrs ? { attrs: cell.attrs } : {}),
    },
  ]);
};

export const DEFAULT_DEMO_GRID = buildDefaultDemoGrid();
