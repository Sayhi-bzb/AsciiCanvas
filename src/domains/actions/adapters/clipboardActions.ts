import {
  exportSelectionToAnsi,
  exportSelectionToJSON,
  exportSelectionToString,
  exportToAnsi,
} from "@/domains/export";
import { GridManager } from "@/shared/utils/grid";
import type { GridMap, Point, SelectionArea } from "@/shared/types";
import type { RichTextCell } from "@/domains/canvas/state/interfaces";
import { clipboard } from "@/shared/services/effects";
import { cloneTextAttributes } from "@/shared/utils/ansi";
import { parseAnsiTextCells } from "@/shared/utils/ansiText";

const MIME_RICH_DATA = "web application/x-ascii-metropolis";
const DEFAULT_ANSI_PASTE_COLOR = "#ffffff";

interface ClipboardPayload {
  plain: string;
  rich: string | null;
}

type ClipboardPayloadFormat = "plain" | "ansi";

const toAnsiLikeClipboardText = (value: string) => value.replaceAll("\u001b[", "[");

export const parseAnsiClipboardText = parseAnsiTextCells;

export const hasClipboardSource = (
  selections: SelectionArea[],
  textCursor: Point | null
) => {
  return selections.length > 0 || !!textCursor;
};

export const buildClipboardPayload = (
  grid: GridMap,
  selections: SelectionArea[],
  textCursor: Point | null,
  brushColor: string,
  format: ClipboardPayloadFormat = "plain"
): ClipboardPayload | null => {
  if (!hasClipboardSource(selections, textCursor)) return null;

  if (selections.length > 0) {
    return {
      plain:
        format === "ansi"
          ? toAnsiLikeClipboardText(exportSelectionToAnsi(grid, selections))
          : exportSelectionToString(grid, selections),
      rich: format === "ansi" ? null : exportSelectionToJSON(grid, selections),
    };
  }

  if (!textCursor) return null;
  const cell = grid.get(GridManager.toKey(textCursor.x, textCursor.y));
  const char = cell?.char || " ";
  const singleCellGrid: GridMap = new Map([
    [
      "0,0",
      {
        char,
        color: cell?.color || brushColor,
        ...(cell?.bgColor ? { bgColor: cell.bgColor } : {}),
        ...(cloneTextAttributes(cell?.attrs)
          ? { attrs: cloneTextAttributes(cell?.attrs) }
          : {}),
      },
    ],
  ]);
  return {
    plain:
      format === "ansi"
        ? toAnsiLikeClipboardText(exportToAnsi(singleCellGrid))
        : char,
    rich:
      format === "ansi"
        ? null
        : JSON.stringify({
            type: "ascii-metropolis-zone",
            version: 1,
            cells: [
              {
                x: 0,
                y: 0,
                char,
                color: cell?.color || brushColor,
                ...(cell?.bgColor ? { bgColor: cell.bgColor } : {}),
                ...(cloneTextAttributes(cell?.attrs)
                  ? { attrs: cloneTextAttributes(cell?.attrs) }
                  : {}),
              },
            ],
          }),
  };
};

interface WriteClipboardOptions {
  event?: ClipboardEvent;
  withRich?: boolean;
}

export const writeClipboardPayload = async (
  payload: ClipboardPayload,
  options: WriteClipboardOptions = {}
) => {
  const { event, withRich = false } = options;

  if (event?.clipboardData) {
    event.preventDefault();
    event.clipboardData.setData("text/plain", payload.plain);
    // Include app-native rich data on copy events so in-app paste can
    // reconstruct multi-cell selections while external apps still receive plain text.
    if (payload.rich) {
      event.clipboardData.setData(MIME_RICH_DATA, payload.rich);
    }
    return true;
  }

  try {
    if (withRich && payload.rich) {
      const clipboardMap: Record<string, Blob> = {
        "text/plain": new Blob([payload.plain], { type: "text/plain" }),
        [MIME_RICH_DATA]: new Blob([payload.rich], {
          type: MIME_RICH_DATA,
        }),
      };

      const richCopied = await clipboard.writeItems([new ClipboardItem(clipboardMap)]);
      if (richCopied) return true;
      return clipboard.writeText(payload.plain);
    }

    return clipboard.writeText(payload.plain);
  } catch {
    return false;
  }
};

const parseRichClipboardText = (rawText: string): RichTextCell[] | null => {
  if (!rawText) return null;
  try {
    const parsed = JSON.parse(rawText) as {
      cells?: RichTextCell[];
    };
    if (!Array.isArray(parsed.cells)) return null;
    return parsed.cells;
  } catch {
    return null;
  }
};

const readRichClipboardCells = async (
  eventDataTransfer?: DataTransfer
): Promise<RichTextCell[] | null> => {
  if (eventDataTransfer) {
    const richData = eventDataTransfer.getData(MIME_RICH_DATA);
    const parsed = parseRichClipboardText(richData);
    if (parsed) return parsed;
  }

  const items = await clipboard.readItems();
  if (items) {
    for (const item of items) {
      if (!item.types.includes(MIME_RICH_DATA)) continue;
      const blob = await item.getType(MIME_RICH_DATA);
      const parsed = parseRichClipboardText(await blob.text());
      if (parsed) return parsed;
    }
  }

  return null;
};

export const readClipboardPayload = async (
  eventDataTransfer?: DataTransfer,
  defaultColor = DEFAULT_ANSI_PASTE_COLOR
) => {
  const richCells = await readRichClipboardCells(eventDataTransfer);
  if (richCells) return { richCells, plainText: null as string | null };

  if (eventDataTransfer) {
    const text = eventDataTransfer.getData("text/plain");
    if (text) {
      const ansiCells = parseAnsiClipboardText(text, defaultColor);
      return ansiCells
        ? { richCells: ansiCells, plainText: null }
        : { richCells: null, plainText: text };
    }
  }

  const text = await clipboard.readText();
  if (text) {
    const ansiCells = parseAnsiClipboardText(text, defaultColor);
    return ansiCells
      ? { richCells: ansiCells, plainText: null }
      : { richCells: null, plainText: text };
  }

  return { richCells: null, plainText: null };
};
