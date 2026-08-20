import { splitGraphemes } from "./graphemes.js";
import { parseCharDeskText } from "./parser.js";
import type {
  CharDeskTextAttributes,
  CharDeskTextCell,
  CharDeskTextRun,
  DecodedCharDeskTextRuns,
  ParseCharDeskTextOptions,
} from "./types.js";

const sameAttrs = (
  left?: CharDeskTextAttributes,
  right?: CharDeskTextAttributes
) =>
  left?.bold === right?.bold &&
  left?.italic === right?.italic &&
  left?.underline === right?.underline &&
  left?.strike === right?.strike &&
  left?.inverse === right?.inverse;

const sameStyle = (run: CharDeskTextRun, cell: CharDeskTextCell) =>
  run.color === cell.color &&
  run.bgColor === cell.bgColor &&
  run.href === cell.href &&
  sameAttrs(run.attrs, cell.attrs);

const appendCell = (runs: CharDeskTextRun[], cell: CharDeskTextCell) => {
  const previous = runs.at(-1);
  if (previous && sameStyle(previous, cell)) {
    previous.text += cell.text;
    return;
  }
  runs.push({
    text: cell.text,
    ...(cell.color ? { color: cell.color } : {}),
    ...(cell.bgColor ? { bgColor: cell.bgColor } : {}),
    ...(cell.attrs ? { attrs: { ...cell.attrs } } : {}),
    ...(cell.href ? { href: cell.href } : {}),
  });
};

const appendNewline = (runs: CharDeskTextRun[]) => {
  const previous = runs.at(-1);
  if (
    previous &&
    !previous.color &&
    !previous.bgColor &&
    !previous.attrs &&
    !previous.href
  ) {
    previous.text += "\n";
  } else {
    runs.push({ text: "\n" });
  }
};

export const decodeCharDeskTextRuns = (
  source: string,
  options: ParseCharDeskTextOptions = {}
): DecodedCharDeskTextRuns => {
  const parsed = parseCharDeskText(source, options);
  const runs: CharDeskTextRun[] = [];
  let cellIndex = 0;
  for (const grapheme of splitGraphemes(parsed.plainText)) {
    if (grapheme === "\n") {
      appendNewline(runs);
      continue;
    }
    const cell = parsed.cells[cellIndex];
    if (!cell) break;
    appendCell(runs, cell);
    cellIndex += 1;
  }
  return {
    source,
    text: parsed.plainText,
    runs,
    hasAnsi: parsed.hasAnsi,
    ansiEvidence: parsed.ansiEvidence,
    diagnostics: parsed.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
};
