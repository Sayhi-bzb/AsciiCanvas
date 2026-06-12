import type { AnsiAnimationDocument } from "@/shared/types";

export interface AnsiCell {
  char: string;
  color: string;
}

export interface AnsiBufferState {
  width: number;
  height: number;
  cursorX: number;
  cursorY: number;
  foreground: string;
  background: string;
  cells: Map<string, AnsiCell>;
}

export interface AnsiRenderFrame {
  width: number;
  height: number;
  cells: [string, AnsiCell][];
}

const DEFAULT_FG = "#e5e7eb";
const DEFAULT_BG = "#0f0f0f";

const clamp = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
};

const toKey = (x: number, y: number) => `${x},${y}`;

const normalizeHexColor = (value: string, fallback: string) => {
  const short = /^#([\da-f]{3})$/i.exec(value);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  const full = /^#([\da-f]{6})$/i.exec(value);
  if (full) return `#${full[1].toLowerCase()}`;
  return fallback;
};

const createState = (doc: AnsiAnimationDocument): AnsiBufferState => ({
  width: Math.max(1, Math.floor(doc.width)),
  height: Math.max(1, Math.floor(doc.height)),
  cursorX: 0,
  cursorY: 0,
  foreground: DEFAULT_FG,
  background: normalizeHexColor(doc.background, DEFAULT_BG),
  cells: new Map<string, AnsiCell>(),
});

const writeCell = (state: AnsiBufferState, char: string) => {
  if (state.cursorX < 0 || state.cursorY < 0) return;
  if (state.cursorX >= state.width || state.cursorY >= state.height) return;
  state.cells.set(toKey(state.cursorX, state.cursorY), {
    char,
    color: state.foreground,
  });
  state.cursorX += 1;
};

const newline = (state: AnsiBufferState) => {
  state.cursorX = 0;
  state.cursorY = Math.min(state.height - 1, state.cursorY + 1);
};

const carriageReturn = (state: AnsiBufferState) => {
  state.cursorX = 0;
};

const clearScreen = (state: AnsiBufferState) => {
  state.cells.clear();
  state.cursorX = 0;
  state.cursorY = 0;
};

const setCursor = (state: AnsiBufferState, row: number, col: number) => {
  state.cursorY = clamp(row - 1, 0, state.height - 1);
  state.cursorX = clamp(col - 1, 0, state.width - 1);
};

const moveCursor = (state: AnsiBufferState, dx: number, dy: number) => {
  state.cursorX = clamp(state.cursorX + dx, 0, state.width - 1);
  state.cursorY = clamp(state.cursorY + dy, 0, state.height - 1);
};

const parseColor = (values: number[]) => {
  if (values.length >= 3 && values[0] === 38 && values[1] === 2) {
    const red = values[2];
    const green = values[3];
    const blue = values[4];
    return `#${[red, green, blue]
      .map((value) => clamp(value ?? 0, 0, 255).toString(16).padStart(2, "0"))
      .join("")}`;
  }
  return null;
};

export const renderAnsiAnimationDocument = (
  document: AnsiAnimationDocument
): AnsiRenderFrame => {
  const state = createState(document);
  const input = document.script;
  let index = 0;

  while (index < input.length) {
    const char = input[index];
    if (char !== "\u001b") {
      if (char === "\n") {
        newline(state);
      } else if (char === "\r") {
        carriageReturn(state);
      } else {
        writeCell(state, char);
      }
      index += 1;
      continue;
    }

    if (input[index + 1] !== "[") {
      index += 1;
      continue;
    }

    index += 2;
    let sequence = "";
    while (index < input.length) {
      const next = input[index];
      sequence += next;
      index += 1;
      if (/[A-Za-z]/.test(next)) break;
    }

    const final = sequence.at(-1);
    const body = sequence.slice(0, -1);
    const values = body.length > 0 ? body.split(";").map((item) => Number.parseInt(item, 10)) : [];

    switch (final) {
      case "m": {
        if (values.length === 0 || values[0] === 0) {
          state.foreground = DEFAULT_FG;
          continue;
        }
        const color = parseColor(values);
        if (color) state.foreground = color;
        continue;
      }
      case "H":
      case "f": {
        const row = values[0] ?? 1;
        const col = values[1] ?? 1;
        setCursor(state, row, col);
        continue;
      }
      case "A":
        moveCursor(state, 0, -(values[0] ?? 1));
        continue;
      case "B":
        moveCursor(state, 0, values[0] ?? 1);
        continue;
      case "C":
        moveCursor(state, values[0] ?? 1, 0);
        continue;
      case "D":
        moveCursor(state, -(values[0] ?? 1), 0);
        continue;
      case "J":
        clearScreen(state);
        continue;
      default:
        continue;
    }
  }

  return {
    width: state.width,
    height: state.height,
    cells: Array.from(state.cells.entries()),
  };
};
