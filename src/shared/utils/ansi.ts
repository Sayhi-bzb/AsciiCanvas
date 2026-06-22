import type { GridCell, TextAttributes } from "@/shared/types";

export type AnsiStyleState = {
  color: string;
  bgColor?: string;
  attrs?: TextAttributes;
};

export type AnsiToken = {
  nextIndex: number;
  style: AnsiStyleState;
  changed: boolean;
};

const DEFAULT_FOREGROUND = "#000000";
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

export const normalizeTextAttributes = (
  attrs?: Partial<TextAttributes> | null
): TextAttributes | undefined => {
  if (!attrs) return undefined;
  const next: TextAttributes = {};
  if (attrs.bold) next.bold = true;
  if (attrs.italic) next.italic = true;
  if (attrs.underline) next.underline = true;
  if (attrs.strike) next.strike = true;
  if (attrs.inverse) next.inverse = true;
  return Object.keys(next).length > 0 ? next : undefined;
};

export const cloneTextAttributes = (attrs?: TextAttributes) =>
  normalizeTextAttributes(attrs);

export const normalizeCellStyle = <T extends { color: string }>(
  cell: T
): T & Pick<GridCell, "bgColor" | "attrs"> => {
  const source = cell as T & {
    bgColor?: unknown;
    attrs?: Partial<TextAttributes>;
  };
  const attrs = normalizeTextAttributes(source.attrs);
  return {
    ...cell,
    ...(typeof source.bgColor === "string" ? { bgColor: source.bgColor } : {}),
    ...(attrs ? { attrs } : {}),
  };
};

export const isSameTextAttributes = (
  a?: TextAttributes,
  b?: TextAttributes
) => {
  const left = normalizeTextAttributes(a);
  const right = normalizeTextAttributes(b);
  return (
    !!left === !!right &&
    left?.bold === right?.bold &&
    left?.italic === right?.italic &&
    left?.underline === right?.underline &&
    left?.strike === right?.strike &&
    left?.inverse === right?.inverse
  );
};

export const effectiveCellStyle = (cell: GridCell) => {
  if (!cell.attrs?.inverse) {
    return {
      color: cell.color,
      bgColor: cell.bgColor,
      attrs: cell.attrs,
    };
  }
  return {
    color: cell.bgColor ?? DEFAULT_FOREGROUND,
    bgColor: cell.color,
    attrs: cell.attrs,
  };
};

const toHexByte = (value: number) => {
  return Math.max(0, Math.min(255, value))
    .toString(16)
    .padStart(2, "0");
};

export const parseAnsiHexColor = (value: string) => {
  const shortHex = /^#([\da-f]{3})$/i.exec(value);
  if (shortHex) {
    const [red, green, blue] = shortHex[1].split("");
    return {
      red: Number.parseInt(`${red}${red}`, 16),
      green: Number.parseInt(`${green}${green}`, 16),
      blue: Number.parseInt(`${blue}${blue}`, 16),
    };
  }

  const fullHex = /^#([\da-f]{6})$/i.exec(value);
  if (fullHex) {
    return {
      red: Number.parseInt(fullHex[1].slice(0, 2), 16),
      green: Number.parseInt(fullHex[1].slice(2, 4), 16),
      blue: Number.parseInt(fullHex[1].slice(4, 6), 16),
    };
  }

  return null;
};

export const toAnsiTruecolor = (prefix: 38 | 48, color: string) => {
  const parsed = parseAnsiHexColor(color);
  if (!parsed) return null;
  return `${prefix};2;${parsed.red};${parsed.green};${parsed.blue}`;
};

const colorFrom256 = (index: number) => {
  const clamped = Math.max(0, Math.min(255, index));
  if (clamped < 8) return BASIC_COLORS[clamped];
  if (clamped < 16) return BRIGHT_COLORS[clamped - 8];
  if (clamped >= 232) {
    const value = 8 + (clamped - 232) * 10;
    return `#${toHexByte(value)}${toHexByte(value)}${toHexByte(value)}`;
  }
  const cube = clamped - 16;
  const red = Math.floor(cube / 36);
  const green = Math.floor((cube % 36) / 6);
  const blue = cube % 6;
  const component = (value: number) => (value === 0 ? 0 : 55 + value * 40);
  return `#${toHexByte(component(red))}${toHexByte(component(green))}${toHexByte(
    component(blue)
  )}`;
};

const cloneStyleState = (style: AnsiStyleState): AnsiStyleState => ({
  color: style.color,
  ...(style.bgColor ? { bgColor: style.bgColor } : {}),
  ...(style.attrs ? { attrs: { ...style.attrs } } : {}),
});

const setAttr = (
  style: AnsiStyleState,
  name: keyof TextAttributes,
  enabled: boolean
) => {
  const attrs = { ...(style.attrs ?? {}) };
  if (enabled) {
    attrs[name] = true;
  } else {
    delete attrs[name];
  }
  style.attrs = normalizeTextAttributes(attrs);
};

export const applySgrCodes = (
  current: AnsiStyleState,
  codes: number[],
  defaultStyle: AnsiStyleState
) => {
  let next = cloneStyleState(current);
  const values = codes.length === 0 ? [0] : codes;
  let changed = false;

  for (let index = 0; index < values.length; index += 1) {
    const code = values[index];
    if (code === 0) {
      next = cloneStyleState(defaultStyle);
      changed = true;
      continue;
    }
    if (code === 1) {
      setAttr(next, "bold", true);
      changed = true;
      continue;
    }
    if (code === 22) {
      setAttr(next, "bold", false);
      changed = true;
      continue;
    }
    if (code === 3 || code === 23) {
      setAttr(next, "italic", code === 3);
      changed = true;
      continue;
    }
    if (code === 4 || code === 24) {
      setAttr(next, "underline", code === 4);
      changed = true;
      continue;
    }
    if (code === 7 || code === 27) {
      setAttr(next, "inverse", code === 7);
      changed = true;
      continue;
    }
    if (code === 9 || code === 29) {
      setAttr(next, "strike", code === 9);
      changed = true;
      continue;
    }
    if (code === 39) {
      next.color = defaultStyle.color;
      changed = true;
      continue;
    }
    if (code === 49) {
      delete next.bgColor;
      if (defaultStyle.bgColor) next.bgColor = defaultStyle.bgColor;
      changed = true;
      continue;
    }
    if (code >= 30 && code <= 37) {
      next.color = BASIC_COLORS[code - 30];
      changed = true;
      continue;
    }
    if (code >= 90 && code <= 97) {
      next.color = BRIGHT_COLORS[code - 90];
      changed = true;
      continue;
    }
    if (code >= 40 && code <= 47) {
      next.bgColor = BASIC_COLORS[code - 40];
      changed = true;
      continue;
    }
    if (code >= 100 && code <= 107) {
      next.bgColor = BRIGHT_COLORS[code - 100];
      changed = true;
      continue;
    }
    if ((code === 38 || code === 48) && values[index + 1] === 5) {
      const color = colorFrom256(values[index + 2]);
      if (code === 38) next.color = color;
      else next.bgColor = color;
      index += 2;
      changed = true;
      continue;
    }
    if ((code === 38 || code === 48) && values[index + 1] === 2) {
      const red = values[index + 2];
      const green = values[index + 3];
      const blue = values[index + 4];
      const color = `#${toHexByte(red)}${toHexByte(green)}${toHexByte(blue)}`;
      if (code === 38) next.color = color;
      else next.bgColor = color;
      index += 4;
      changed = true;
    }
  }

  return { style: next, changed };
};

export const parseSgrSequenceAt = (
  input: string,
  index: number,
  current: AnsiStyleState,
  defaultStyle: AnsiStyleState,
  allowBracketAnsi = false
): AnsiToken | null => {
  const startsWithEscape = input[index] === "\u001b" && input[index + 1] === "[";
  const startsWithBracket = allowBracketAnsi && input[index] === "[";
  if (!startsWithEscape && !startsWithBracket) return null;

  const sequenceStart = startsWithEscape ? index + 2 : index + 1;
  const sequenceEnd = input.indexOf("m", sequenceStart);
  if (sequenceEnd === -1) return null;

  const body = input.slice(sequenceStart, sequenceEnd);
  if (body && !/^[\d;]*$/.test(body)) return null;
  const codes = body === "" ? [0] : body.split(";").map((part) => Number(part));
  if (codes.some((code) => !Number.isFinite(code))) return null;
  const result = applySgrCodes(current, codes, defaultStyle);
  return {
    nextIndex: sequenceEnd + 1,
    style: result.style,
    changed: result.changed,
  };
};

export const styleStateToCell = (
  char: string,
  style: AnsiStyleState
): GridCell => ({
  char,
  color: style.color,
  ...(style.bgColor ? { bgColor: style.bgColor } : {}),
  ...(style.attrs ? { attrs: { ...style.attrs } } : {}),
});
