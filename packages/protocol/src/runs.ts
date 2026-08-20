import { getGraphemeCellWidth, splitGraphemes } from "./graphemes.js";
import { CHARDESK_TEXT_PROTOCOL_VERSION } from "./parser.js";
import type {
  CharDeskTextAttributes,
  CharDeskTextDiagnostic,
  CharDeskTextRun,
  CharDeskTextStyle,
  LayoutCharDeskTextRunsOptions,
  ParsedCharDeskText,
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

export const layoutCharDeskTextRuns = (
  runs: readonly CharDeskTextRun[],
  options: LayoutCharDeskTextRunsOptions = {}
): ParsedCharDeskText => {
  const tabSize = options.tabSize ?? 4;
  if (!Number.isInteger(tabSize) || tabSize < 1) {
    throw new RangeError("tabSize must be a positive integer.");
  }

  const source = runs.map((run) => run.text).join("");
  const cells: ParsedCharDeskText["cells"] = [];
  const diagnostics: CharDeskTextDiagnostic[] = [];
  const plainParts: string[] = [];
  let x = 0;
  let y = 0;
  let width = 0;
  let hasLayout = false;

  const pushText = (text: string, style: CharDeskTextStyle, href?: string) => {
    for (const grapheme of splitGraphemes(text)) {
      const cellWidth = getGraphemeCellWidth(grapheme);
      cells.push({
        x,
        y,
        width: cellWidth,
        text: grapheme,
        ...(style.color ? { color: style.color } : {}),
        ...(style.bgColor ? { bgColor: style.bgColor } : {}),
        ...(style.attrs ? { attrs: cloneAttrs(style.attrs) } : {}),
        ...(href ? { href } : {}),
      });
      x += cellWidth;
      width = Math.max(width, x);
      plainParts.push(grapheme);
      hasLayout = true;
    }
  };

  let sourceOffset = 0;
  for (const run of runs) {
    const style = mergeStyle(options.defaultStyle ?? {}, run);
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
        continue;
      }
      if (char === "\t") {
        pushText(" ".repeat(tabSize - (x % tabSize)), style, run.href);
        index += 1;
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
        continue;
      }
      const grapheme = splitGraphemes(run.text.slice(index))[0];
      if (!grapheme) break;
      pushText(grapheme, style, run.href);
      index += grapheme.length;
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
    cells,
    hasAnsi: false,
    ansiEvidence: "none",
    diagnostics,
  };
};
