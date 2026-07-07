import type {
  GridCell,
  StructuredTextRangeStyle,
  StructuredTextStyleRange,
} from "@/shared/types";
import { parseAnsiTextCells } from "@/shared/utils/ansiText";
import type { StructuredComponentDefinition } from "../components/types";

const AMIBIOS_SOURCE = `[37;44m╭───────────────────────────────────────────────────────────────────────────────╮[0m
[37;44m│   [1mAMIBIOS EASY SETUP UTILITY - VERSION 1.24.2026[22m                              │[0m
[37;44m├───────────────────────────────────────────────────────────────────────────────┤[0m
[37;44m│ [7m Main [27m     Advanced     Power     Boot     Security     Exit                  │[0m
[37;44m├───────────────────────────────────────┬───────────────────────────────────────┤[0m
[37;44m│                                       │                                       │[0m
[37;44m│  System Time:       [[1m11:05:25[22m]        │ Item Specific Help                    │[0m
[37;44m│  System Date:       [[1m07/02/2026[22m]      │                                       │[0m
[37;44m│                                       │ Use [Enter], [TAB]                    │[0m
[37;44m│  Legacy Diskette A:  [1.44M, 3.5 in.] │ or [SHIFT-TAB] to select a field.     │[0m
[37;44m│                                       │                                       │[0m
[37;44m│ ┌─ Primary Master ──────────────────┐ │ Use [+] or [-] to                     │[0m
[37;44m│ │ Type:             [Auto]          │ │ configure system Time.                │[0m
[37;44m│ │ LBA Mode:         [On]            │ │                                       │[0m
[37;44m│ │ Block Mode:       [4 Sectors]     │ │                                       │[0m
[37;44m│ └───────────────────────────────────┘ │                                       │[0m
[37;44m│                                       │                                       │[0m
[37;44m│                                       │                                       │[0m
[37;44m│  [7m> System Memory:     640 KB        [27m  │                                       │[0m
[37;44m│    Extended Memory:   16384 MB        │                                       │[0m
[37;44m│                                       │                                       │[0m
[37;44m│ [33m  [1;31mCPU Temperature:   45°C (Normal)[22;37m   │                                       │[0m
[37;44m├───────────────────────────────────────┴───────────────────────────────────────┤[0m
[37;44m│ F1:Help  ↑↓:Select Item  +/-:Change Values  F5:Setup Defaults  F10:Save & Exit│[0m
[37;44m╰───────────────────────────────────────────────────────────────────────────────╯[0m`;

const AMIBIOS_BASE_STYLE = {
  color: "#c0c0c0",
  bgColor: "#000080",
};

const styleFromCell = (cell: Pick<GridCell, "color" | "bgColor" | "attrs">) => ({
  color: cell.color,
  ...(cell.bgColor ? { bgColor: cell.bgColor } : {}),
  ...(cell.attrs ? { attrs: { ...cell.attrs } } : {}),
});

const stylesEqual = (
  left: StructuredTextRangeStyle,
  right: StructuredTextRangeStyle
) =>
  left.color === right.color &&
  left.bgColor === right.bgColor &&
  !!left.attrs?.bold === !!right.attrs?.bold &&
  !!left.attrs?.italic === !!right.attrs?.italic &&
  !!left.attrs?.underline === !!right.attrs?.underline &&
  !!left.attrs?.strike === !!right.attrs?.strike &&
  !!left.attrs?.inverse === !!right.attrs?.inverse;

const buildStyledTextFromAnsi = (source: string) => {
  const cells = parseAnsiTextCells(source, AMIBIOS_BASE_STYLE.color) ?? [];
  const width = Math.max(...cells.map((cell) => cell.x)) + 1;
  const height = Math.max(...cells.map((cell) => cell.y)) + 1;
  const chars = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => " ")
  );
  const styles = Array.from({ length: height }, () =>
    Array.from({ length: width }, (): StructuredTextRangeStyle | null => null)
  );

  cells.forEach((cell) => {
    chars[cell.y][cell.x] = cell.char;
    styles[cell.y][cell.x] = styleFromCell(cell);
  });

  let text = "";
  let offset = 0;
  let activeRange: StructuredTextStyleRange | null = null;
  const styleRanges: StructuredTextStyleRange[] = [];

  const pushStyle = (style: StructuredTextRangeStyle) => {
    if (activeRange && stylesEqual(activeRange.style, style)) {
      activeRange.end = offset + 1;
      return;
    }
    activeRange = { start: offset, end: offset + 1, style };
    styleRanges.push(activeRange);
  };

  chars.forEach((row, y) => {
    row.forEach((char, x) => {
      text += char;
      pushStyle(styles[y][x] ?? AMIBIOS_BASE_STYLE);
      offset += 1;
    });
    if (y < chars.length - 1) {
      text += "\n";
      offset += 1;
    }
  });

  return { text, styleRanges };
};

const AMIBIOS_TEXT = buildStyledTextFromAnsi(AMIBIOS_SOURCE);

export const AMIBIOS_TEMPLATE: StructuredComponentDefinition = {
  id: "amibios",
  label: "AMIBIOS",
  build: ({ createText }) => [
    createText(
      AMIBIOS_TEXT.text,
      { x: 0, y: 0 },
      0,
      AMIBIOS_TEXT.styleRanges,
      AMIBIOS_BASE_STYLE,
      "screen"
    ),
  ],
};