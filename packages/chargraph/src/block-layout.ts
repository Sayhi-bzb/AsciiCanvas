import { parseCharDeskTextRows } from "@chardesk/protocol";
import { createCharGraphFragment } from "./fragments.js";
import { defineCharGraphRenderer } from "./model.js";
import type {
  CharGraphDiagnostic,
  CharGraphFragment,
  CharGraphRenderResult,
  CharGraphSourceRange,
} from "./model.js";

export type BlockLayoutBlock = {
  source: string;
  range: CharGraphSourceRange;
};

export type BlockLayoutDocument = {
  rows: BlockLayoutBlock[][];
};

export type BlockLayoutParseResult = {
  document: BlockLayoutDocument | null;
  recognized: boolean;
  diagnostics: CharGraphDiagnostic[];
};

export type BlockLayoutRenderOptions = {
  columnGap?: number;
  rowGap?: number;
};

const NEXT_FIELD = "|||";
const NEXT_ROW = "---";

const classifyControlLine = (line: string) => {
  const trimmed = line.trim();
  if (trimmed === NEXT_FIELD) return "next-field" as const;
  if (trimmed === NEXT_ROW) return "next-row" as const;
  return null;
};

const unescapeControlLine = (line: string) => {
  const match = line.match(/^([ \t]*)(\\+)(\|\|\||---)([ \t]*)$/u);
  if (!match) return line;
  return `${match[1]}${match[2]!.slice(1)}${match[3]}${match[4]}`;
};

const escapeControlLine = (line: string) => {
  const match = line.match(/^([ \t]*)(\\*)(\|\|\||---)([ \t]*)$/u);
  if (!match) return line;
  return `${match[1]}\\${match[2]}${match[3]}${match[4]}`;
};

const scanSourceLines = (source: string) => {
  const lines: { text: string; start: number; next: number }[] = [];
  let start = 0;
  while (start <= source.length) {
    const newline = source.indexOf("\n", start);
    if (newline < 0) {
      const raw = source.slice(start);
      lines.push({
        text: raw.endsWith("\r") ? raw.slice(0, -1) : raw,
        start,
        next: source.length,
      });
      break;
    }
    const raw = source.slice(start, newline);
    lines.push({
      text: raw.endsWith("\r") ? raw.slice(0, -1) : raw,
      start,
      next: newline + 1,
    });
    start = newline + 1;
    if (start === source.length) {
      lines.push({ text: "", start, next: start });
      break;
    }
  }
  return lines;
};

export const parseBlockLayout = (source: string): BlockLayoutParseResult => {
  const rows: BlockLayoutBlock[][] = [[]];
  let blockLines: string[] = [];
  let blockStart = 0;
  let offset = 0;
  let controlCount = 0;

  const finishBlock = (to: number) => {
    rows.at(-1)!.push({
      source: blockLines.join("\n"),
      range: { from: blockStart, to },
    });
    blockLines = [];
  };

  scanSourceLines(source).forEach((line) => {
    const direction = classifyControlLine(line.text);
    if (!direction) {
      blockLines.push(unescapeControlLine(line.text));
      offset = line.next;
      return;
    }

    controlCount += 1;
    finishBlock(offset);
    if (direction === "next-row") rows.push([]);
    blockStart = line.next;
    offset = line.next;
  });

  finishBlock(source.length);
  if (controlCount === 0) {
    return { document: null, recognized: false, diagnostics: [] };
  }
  return { document: { rows }, recognized: true, diagnostics: [] };
};

export const serializeBlockLayout = (document: BlockLayoutDocument) =>
  document.rows
    .map((row) =>
      row
        .map((block) => block.source.split("\n").map(escapeControlLine).join("\n"))
        .join(`\n${NEXT_FIELD}\n`)
    )
    .join(`\n${NEXT_ROW}\n`);

type PlacedSpan = {
  x: number;
  width: number;
  fragment: CharGraphFragment;
};

const normalizeGap = (value: number | undefined, fallback: number) =>
  Number.isInteger(value) && value !== undefined && value >= 0 ? value : fallback;

const renderDocument = (
  document: BlockLayoutDocument,
  options: BlockLayoutRenderOptions
): Pick<CharGraphRenderResult, "fragments" | "diagnostics"> => {
  const columnGap = normalizeGap(options.columnGap, 4);
  const rowGap = normalizeGap(options.rowGap, 1);
  const outputRows = new Map<number, PlacedSpan[]>();
  const diagnostics: CharGraphDiagnostic[] = [];
  let originY = 0;
  let outputHeight = 0;

  for (const layoutRow of document.rows) {
    let originX = 0;
    let layoutRowHeight = 1;
    for (const block of layoutRow) {
      const parsed = parseCharDeskTextRows(block.source, { syntax: "auto" });
      const blockHeight = Math.max(1, parsed.height);
      layoutRowHeight = Math.max(layoutRowHeight, blockHeight);
      diagnostics.push(
        ...parsed.diagnostics.map((item) => ({
          code: `block-layout.protocol.${item.code}`,
          message: item.message,
          offset: block.range.from,
          length: Math.max(1, block.range.to - block.range.from),
        }))
      );

      for (const row of parsed.rows) {
        const targetY = originY + row.y;
        const target = outputRows.get(targetY) ?? [];
        for (const span of row.spans) {
          target.push({
            x: originX + span.x,
            width: span.width,
            fragment: createCharGraphFragment(
              span.text,
              span,
              block.range,
              span.href
            ),
          });
        }
        outputRows.set(targetY, target);
      }
      originX += parsed.width + columnGap;
    }
    outputHeight = Math.max(outputHeight, originY + layoutRowHeight);
    originY += layoutRowHeight + rowGap;
  }

  const fragments: CharGraphFragment[] = [];
  for (let y = 0; y < outputHeight; y += 1) {
    const spans = [...(outputRows.get(y) ?? [])].sort((left, right) => left.x - right.x);
    let cursorX = 0;
    for (const span of spans) {
      if (span.x > cursorX) {
        fragments.push(createCharGraphFragment(" ".repeat(span.x - cursorX)));
      }
      fragments.push(span.fragment);
      cursorX = Math.max(cursorX, span.x + span.width);
    }
    if (y < outputHeight - 1) fragments.push(createCharGraphFragment("\n"));
  }

  return { fragments, diagnostics };
};

export const renderBlockLayout = (
  source: string,
  options: BlockLayoutRenderOptions = {}
): CharGraphRenderResult => {
  const parsed = parseBlockLayout(source);
  if (!parsed.document) {
    return {
      fragments: [createCharGraphFragment(source)],
      recognized: false,
      diagnostics: [],
    };
  }
  return {
    ...renderDocument(parsed.document, options),
    recognized: true,
  };
};

export const blockLayoutRenderer = defineCharGraphRenderer<BlockLayoutRenderOptions>({
  id: "block-layout",
  render: renderBlockLayout,
});
