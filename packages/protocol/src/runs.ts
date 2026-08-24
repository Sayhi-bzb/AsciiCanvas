import { createGraphemeCursor, getGraphemeCellWidth } from "./graphemes.js";
import { CHARDESK_TEXT_PROTOCOL_VERSION } from "./parser.js";
import {
  appendCharDeskTextSpan,
  materializeCharDeskTextRows,
} from "./row-spans.js";
import type {
  CharDeskTextAttributes,
  CharDeskTextDiagnostic,
  CharDeskTextRun,
  CharDeskTextStyle,
  LayoutCharDeskTextRunsOptions,
  ParsedCharDeskText,
  ParsedCharDeskTextRows,
} from "./types.js";

const cloneAttrs = (attrs?: CharDeskTextAttributes) =>
  attrs ? { ...attrs } : undefined;

const mergeStyle = (
  defaults: CharDeskTextStyle,
  run: CharDeskTextRun
): CharDeskTextStyle => ({
  ...((run.color ?? defaults.color) ? { color: run.color ?? defaults.color } : {}),
  ...((run.bgColor ?? defaults.bgColor)
    ? { bgColor: run.bgColor ?? defaults.bgColor }
    : {}),
  ...((run.attrs ?? defaults.attrs)
    ? { attrs: cloneAttrs(run.attrs ?? defaults.attrs) }
    : {}),
});

export const layoutCharDeskTextRunsToRows = (
  runs: readonly CharDeskTextRun[],
  options: LayoutCharDeskTextRunsOptions = {}
): ParsedCharDeskTextRows => {
  const tabSize = options.tabSize ?? 4;
  if (!Number.isInteger(tabSize) || tabSize < 1) {
    throw new RangeError("tabSize must be a positive integer.");
  }

  const source = runs.map((run) => run.text).join("");
  const rows: ParsedCharDeskTextRows["rows"] = [];
  const diagnostics: CharDeskTextDiagnostic[] = [];
  const plainParts: string[] = [];
  let x = 0;
  let y = 0;
  let width = 0;
  let hasLayout = false;

  const pushGrapheme = (
    grapheme: string,
    style: CharDeskTextStyle,
    href?: string
  ) => {
    const cellWidth = getGraphemeCellWidth(grapheme);
    appendCharDeskTextSpan(rows, x, y, cellWidth, grapheme, style, href);
    x += cellWidth;
    width = Math.max(width, x);
    plainParts.push(grapheme);
    hasLayout = true;
  };

  let sourceOffset = 0;
  for (const run of runs) {
    const style = mergeStyle(options.defaultStyle ?? {}, run);
    const graphemes = createGraphemeCursor(run.text);
    let index = 0;
    while (index < run.text.length) {
      const char = run.text[index];
      if (char === "\r" || char === "\n") {
        const isCrLf = char === "\r" && run.text[index + 1] === "\n";
        width = Math.max(width, x);
        x = 0;
        y += 1;
        plainParts.push("\n");
        hasLayout = true;
        index += isCrLf ? 2 : 1;
        graphemes.advanceTo(index);
        continue;
      }
      if (char === "\t") {
        const spaces = tabSize - (x % tabSize);
        for (let space = 0; space < spaces; space += 1) {
          pushGrapheme(" ", style, run.href);
        }
        index += 1;
        graphemes.advanceTo(index);
        continue;
      }
      if (char !== undefined && char.charCodeAt(0) < 0x20) {
        diagnostics.push({
          code: char === "\u001b" ? "malformed-ansi" : "unsupported-control",
          offset: sourceOffset + index,
          length: 1,
          message:
            char === "\u001b"
              ? "Malformed ANSI escape was ignored."
              : `Unsupported control character U+${char
                  .charCodeAt(0)
                  .toString(16)
                  .toUpperCase()
                  .padStart(4, "0")} was ignored.`,
        });
        index += 1;
        graphemes.advanceTo(index);
        continue;
      }
      const next = graphemes.take(index);
      if (!next) break;
      pushGrapheme(next.segment, style, run.href);
      index = next.nextIndex;
    }
    sourceOffset += run.text.length;
  }

  width = Math.max(width, x);
  return {
    version: CHARDESK_TEXT_PROTOCOL_VERSION,
    source,
    plainText: plainParts.join(""),
    width,
    height: hasLayout ? y + 1 : 0,
    rows,
    hasAnsi: false,
    ansiEvidence: "none",
    diagnostics,
  };
};

export const layoutCharDeskTextRuns = (
  runs: readonly CharDeskTextRun[],
  options: LayoutCharDeskTextRunsOptions = {}
): ParsedCharDeskText => {
  const parsed = layoutCharDeskTextRunsToRows(runs, options);
  return {
    ...parsed,
    cells: materializeCharDeskTextRows(parsed.rows),
  };
};
