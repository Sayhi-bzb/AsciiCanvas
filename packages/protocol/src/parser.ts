import { getGraphemeCellWidth, splitGraphemes } from "./graphemes.js";
import type {
  AsciiCanvasTextAttributes,
  AsciiCanvasTextDiagnostic,
  AsciiCanvasTextStyle,
  ParseAsciiCanvasTextOptions,
  ParsedAsciiCanvasText,
} from "./types.js";

const BASIC_COLORS = [
  "#000000",
  "#800000",
  "#008000",
  "#808000",
  "#000080",
  "#800080",
  "#008080",
  "#c0c0c0",
] as const;

const BRIGHT_COLORS = [
  "#808080",
  "#ff0000",
  "#00ff00",
  "#ffff00",
  "#0000ff",
  "#ff00ff",
  "#00ffff",
  "#ffffff",
] as const;

type ParserStyle = AsciiCanvasTextStyle & { href?: string };

type SgrResult = {
  nextIndex: number;
  style: ParserStyle;
  recognized: boolean;
  unsupportedCodes: number[];
};

type LinkResult = {
  nextIndex: number;
  href: string;
};

const cloneAttrs = (attrs?: AsciiCanvasTextAttributes) =>
  attrs ? { ...attrs } : undefined;

const cloneStyle = (style: ParserStyle): ParserStyle => ({
  ...(style.color ? { color: style.color } : {}),
  ...(style.bgColor ? { bgColor: style.bgColor } : {}),
  ...(style.attrs ? { attrs: cloneAttrs(style.attrs) } : {}),
  ...(style.href ? { href: style.href } : {}),
});

const normalizeAttrs = (attrs: AsciiCanvasTextAttributes) =>
  Object.keys(attrs).length > 0 ? attrs : undefined;

const setAttr = (
  style: ParserStyle,
  name: keyof AsciiCanvasTextAttributes,
  enabled: boolean
) => {
  const attrs = { ...(style.attrs ?? {}) };
  if (enabled) attrs[name] = true;
  else delete attrs[name];
  style.attrs = normalizeAttrs(attrs);
};

const toByte = (value: number) =>
  Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");

const colorFrom256 = (value: number) => {
  const index = Math.max(0, Math.min(255, value));
  if (index < 8) return BASIC_COLORS[index];
  if (index < 16) return BRIGHT_COLORS[index - 8];
  if (index >= 232) {
    const gray = 8 + (index - 232) * 10;
    return `#${toByte(gray)}${toByte(gray)}${toByte(gray)}`;
  }
  const cube = index - 16;
  const red = Math.floor(cube / 36);
  const green = Math.floor((cube % 36) / 6);
  const blue = cube % 6;
  const component = (part: number) => (part === 0 ? 0 : 55 + part * 40);
  return `#${toByte(component(red))}${toByte(component(green))}${toByte(
    component(blue)
  )}`;
};

const applySgrCodes = (
  current: ParserStyle,
  values: number[],
  defaults: ParserStyle
) => {
  let next = cloneStyle(current);
  let recognized = false;
  const unsupportedCodes: number[] = [];

  for (let index = 0; index < values.length; index += 1) {
    const code = values[index];
    if (code === undefined) continue;
    if (code === 0) {
      const href = next.href;
      next = cloneStyle(defaults);
      if (href) next.href = href;
      recognized = true;
    } else if (code === 1 || code === 22) {
      setAttr(next, "bold", code === 1);
      recognized = true;
    } else if (code === 3 || code === 23) {
      setAttr(next, "italic", code === 3);
      recognized = true;
    } else if (code === 4 || code === 24) {
      setAttr(next, "underline", code === 4);
      recognized = true;
    } else if (code === 7 || code === 27) {
      setAttr(next, "inverse", code === 7);
      recognized = true;
    } else if (code === 9 || code === 29) {
      setAttr(next, "strike", code === 9);
      recognized = true;
    } else if (code === 39) {
      if (defaults.color) next.color = defaults.color;
      else delete next.color;
      recognized = true;
    } else if (code === 49) {
      if (defaults.bgColor) next.bgColor = defaults.bgColor;
      else delete next.bgColor;
      recognized = true;
    } else if (code >= 30 && code <= 37) {
      next.color = BASIC_COLORS[code - 30];
      recognized = true;
    } else if (code >= 90 && code <= 97) {
      next.color = BRIGHT_COLORS[code - 90];
      recognized = true;
    } else if (code >= 40 && code <= 47) {
      next.bgColor = BASIC_COLORS[code - 40];
      recognized = true;
    } else if (code >= 100 && code <= 107) {
      next.bgColor = BRIGHT_COLORS[code - 100];
      recognized = true;
    } else if ((code === 38 || code === 48) && values[index + 1] === 5) {
      const paletteIndex = values[index + 2];
      if (paletteIndex === undefined) return null;
      const color = colorFrom256(paletteIndex);
      if (code === 38) next.color = color;
      else next.bgColor = color;
      index += 2;
      recognized = true;
    } else if ((code === 38 || code === 48) && values[index + 1] === 2) {
      const red = values[index + 2];
      const green = values[index + 3];
      const blue = values[index + 4];
      if (red === undefined || green === undefined || blue === undefined) {
        return null;
      }
      const color = `#${toByte(red)}${toByte(green)}${toByte(blue)}`;
      if (code === 38) next.color = color;
      else next.bgColor = color;
      index += 4;
      recognized = true;
    } else {
      unsupportedCodes.push(code);
    }
  }

  return { style: next, recognized, unsupportedCodes };
};

const parseSgrAt = (
  input: string,
  offset: number,
  current: ParserStyle,
  defaults: ParserStyle,
  allowBracket: boolean,
  forceBracket: boolean
): SgrResult | null => {
  const escaped = input[offset] === "\u001b" && input[offset + 1] === "[";
  const bracketed = allowBracket && input[offset] === "[";
  if (!escaped && !bracketed) return null;

  const bodyStart = offset + (escaped ? 2 : 1);
  const bodyEnd = input.indexOf("m", bodyStart);
  if (bodyEnd === -1) return null;
  const body = input.slice(bodyStart, bodyEnd);
  if (body && !/^[\d;]*$/.test(body)) return null;
  const values = body === "" ? [0] : body.split(";").map(Number);
  const applied = applySgrCodes(current, values, defaults);
  if (!applied) return null;
  if (bracketed && !forceBracket && !applied.recognized) return null;

  return {
    nextIndex: bodyEnd + 1,
    ...applied,
  };
};

const parseOsc8At = (
  input: string,
  offset: number,
  allowShorthand: boolean
): LinkResult | null => {
  const standard = input.startsWith("\u001b]8;;", offset);
  const shorthand = allowShorthand && input.startsWith("]8;;", offset);
  if (!standard && !shorthand) return null;

  const hrefStart = offset + (standard ? 5 : 4);
  if (standard) {
    const st = input.indexOf("\u001b\\", hrefStart);
    const bel = input.indexOf("\u0007", hrefStart);
    const candidates = [st, bel].filter((value) => value >= 0);
    if (candidates.length === 0) return null;
    const end = Math.min(...candidates);
    const terminatorLength = end === st ? 2 : 1;
    return { href: input.slice(hrefStart, end), nextIndex: end + terminatorLength };
  }

  if (input[hrefStart] === "[" || hrefStart >= input.length) {
    return { href: "", nextIndex: hrefStart };
  }
  const slashEnd = input.indexOf("\\", hrefStart);
  const sgrStart = input.indexOf("[", hrefStart);
  const hasSgrBoundary =
    sgrStart !== -1 && (slashEnd === -1 || sgrStart < slashEnd);
  const end = hasSgrBoundary ? sgrStart : slashEnd;
  if (end === -1) return null;
  return {
    href: input.slice(hrefStart, end),
    nextIndex: hasSgrBoundary ? end : end + 1,
  };
};

const diagnostic = (
  diagnostics: AsciiCanvasTextDiagnostic[],
  code: AsciiCanvasTextDiagnostic["code"],
  offset: number,
  length: number,
  message: string
) => diagnostics.push({ code, offset, length, message });

export const ASCII_CANVAS_TEXT_PROTOCOL_VERSION = 1 as const;

export const parseAsciiCanvasText = (
  source: string,
  options: ParseAsciiCanvasTextOptions = {}
): ParsedAsciiCanvasText => {
  const syntax = options.syntax ?? "auto";
  const tabSize = options.tabSize ?? 4;
  if (!Number.isInteger(tabSize) || tabSize < 1) {
    throw new RangeError("tabSize must be a positive integer.");
  }

  const defaults = cloneStyle(options.defaultStyle ?? {});
  let style = cloneStyle(defaults);
  const cells: ParsedAsciiCanvasText["cells"] = [];
  const diagnostics: AsciiCanvasTextDiagnostic[] = [];
  const plainParts: string[] = [];
  let index = 0;
  let x = 0;
  let y = 0;
  let width = 0;
  let hasAnsi = false;
  let hasLayout = false;

  const pushText = (text: string) => {
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
        ...(style.href ? { href: style.href } : {}),
      });
      x += cellWidth;
      width = Math.max(width, x);
      plainParts.push(grapheme);
      hasLayout = true;
    }
  };

  while (index < source.length) {
    if (syntax !== "plain") {
      const link = parseOsc8At(source, index, true);
      if (link) {
        if (link.href) style.href = link.href;
        else delete style.href;
        hasAnsi = true;
        index = link.nextIndex;
        continue;
      }

      const sgr = parseSgrAt(
        source,
        index,
        style,
        defaults,
        true,
        syntax === "ansi"
      );
      if (sgr) {
        style = sgr.style;
        hasAnsi = true;
        for (const code of sgr.unsupportedCodes) {
          diagnostic(
            diagnostics,
            "unsupported-sgr",
            index,
            sgr.nextIndex - index,
            `Unsupported SGR code ${code} was ignored.`
          );
        }
        index = sgr.nextIndex;
        continue;
      }
    }

    const char = source[index];
    if (char === "\r" || char === "\n") {
      const isCrLf = char === "\r" && source[index + 1] === "\n";
      width = Math.max(width, x);
      x = 0;
      y += 1;
      plainParts.push("\n");
      hasLayout = true;
      index += isCrLf ? 2 : 1;
      continue;
    }
    if (char === "\t") {
      const spaces = tabSize - (x % tabSize);
      pushText(" ".repeat(spaces));
      index += 1;
      continue;
    }
    if (char !== undefined && char.charCodeAt(0) < 0x20) {
      diagnostic(
        diagnostics,
        char === "\u001b" ? "malformed-ansi" : "unsupported-control",
        index,
        1,
        char === "\u001b"
          ? "Malformed ANSI escape was ignored."
          : `Unsupported control character U+${char
              .charCodeAt(0)
              .toString(16)
              .toUpperCase()
              .padStart(4, "0")} was ignored.`
      );
      index += 1;
      continue;
    }

    const grapheme = splitGraphemes(source.slice(index))[0];
    if (!grapheme) break;
    pushText(grapheme);
    index += grapheme.length;
  }

  width = Math.max(width, x);
  return {
    version: ASCII_CANVAS_TEXT_PROTOCOL_VERSION,
    source,
    plainText: plainParts.join(""),
    width,
    height: hasLayout ? y + 1 : 0,
    cells,
    hasAnsi,
    diagnostics,
  };
};

export const stripAsciiCanvasAnsi = (
  source: string,
  options?: ParseAsciiCanvasTextOptions
) => parseAsciiCanvasText(source, options).plainText;
