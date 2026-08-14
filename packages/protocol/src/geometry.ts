import { parseCharDeskText } from "./parser.js";
import type {
  CharDeskGeometryComparison,
  CharDeskGeometryMismatch,
  CharDeskGeometrySnapshot,
  CompareCharDeskGeometryOptions,
} from "./types.js";

const hashGeometry = (value: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const firstDifferentOffset = (expected: string, actual: string) => {
  const sharedLength = Math.min(expected.length, actual.length);
  for (let offset = 0; offset < sharedLength; offset += 1) {
    if (expected[offset] !== actual[offset]) return offset;
  }
  return sharedLength;
};

export const createCharDeskGeometrySnapshot = (
  source: string,
  options: CompareCharDeskGeometryOptions = {}
): CharDeskGeometrySnapshot => {
  const parsed = parseCharDeskText(source, {
    syntax: options.syntax ?? "auto",
    tabSize: options.tabSize,
  });
  const shape = parsed.cells
    .map((cell) => `${cell.x},${cell.y},${cell.width}`)
    .join(";");

  return {
    version: parsed.version,
    plainText: parsed.plainText,
    width: parsed.width,
    height: parsed.height,
    cells: parsed.cells.map(({ x, y, width, text }) => ({ x, y, width, text })),
    signature: `v${parsed.version}:${parsed.width}x${parsed.height}:${hashGeometry(shape)}`,
    hasAnsi: parsed.hasAnsi,
    diagnostics: parsed.diagnostics,
  };
};

const findMismatch = (
  expected: CharDeskGeometrySnapshot,
  actual: CharDeskGeometrySnapshot
): CharDeskGeometryMismatch | undefined => {
  if (expected.plainText !== actual.plainText) {
    const offset = firstDifferentOffset(expected.plainText, actual.plainText);
    return {
      code: "plain-text",
      message: `Visible text differs at UTF-16 offset ${offset}.`,
      offset,
    };
  }
  if (expected.width !== actual.width || expected.height !== actual.height) {
    return {
      code: "dimensions",
      message: `Canvas dimensions changed from ${expected.width}x${expected.height} to ${actual.width}x${actual.height}.`,
    };
  }
  if (expected.cells.length !== actual.cells.length) {
    return {
      code: "cell-count",
      message: `Visible cell count changed from ${expected.cells.length} to ${actual.cells.length}.`,
    };
  }

  for (let index = 0; index < expected.cells.length; index += 1) {
    const expectedCell = expected.cells[index];
    const actualCell = actual.cells[index];
    if (
      expectedCell?.x !== actualCell?.x ||
      expectedCell?.y !== actualCell?.y ||
      expectedCell?.width !== actualCell?.width ||
      expectedCell?.text !== actualCell?.text
    ) {
      return {
        code: "cell",
        message: `Cell ${index} changed its grapheme or position.`,
        cellIndex: index,
        expected: expectedCell,
        actual: actualCell,
      };
    }
  }
  return undefined;
};

export const compareCharDeskGeometry = (
  plainText: string,
  ansiText: string,
  options: Omit<CompareCharDeskGeometryOptions, "syntax"> = {}
): CharDeskGeometryComparison => {
  const expected = createCharDeskGeometrySnapshot(plainText, {
    ...options,
    syntax: "plain",
  });
  const actual = createCharDeskGeometrySnapshot(ansiText, {
    ...options,
    syntax: "ansi",
  });
  const mismatch = findMismatch(expected, actual);

  return {
    matches: mismatch === undefined,
    expected,
    actual,
    ...(mismatch ? { mismatch } : {}),
  };
};
