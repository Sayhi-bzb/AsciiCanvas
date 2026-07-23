import { splitGraphemes } from "./textSegmentation";
import { resolveRenderFontRoute } from "./fontRouting";
import { WIDE_EAST_ASIAN_RANGES } from "./generated/eastAsianWidth";

const isWideEastAsianCodePoint = (codePoint: number) => {
  let low = 0;
  let high = WIDE_EAST_ASIAN_RANGES.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const [start, end] = WIDE_EAST_ASIAN_RANGES[middle];
    if (codePoint < start) {
      high = middle - 1;
    } else if (codePoint > end) {
      low = middle + 1;
    } else {
      return true;
    }
  }
  return false;
};

export const getCellOccupancy = (grapheme: string) => {
  if (!grapheme) return 1;

  const firstCodePoint = grapheme.codePointAt(0) ?? 0;
  if (resolveRenderFontRoute(grapheme) === "emoji") return 2;
  if (firstCodePoint < 128 && splitGraphemes(grapheme).length === 1) return 1;

  if (isWideEastAsianCodePoint(firstCodePoint)) {
    return 2;
  }

  return 1;
};

export const isWideCell = (grapheme: string) => getCellOccupancy(grapheme) === 2;

export const getTextCellWidth = (text: string) => {
  return splitGraphemes(text).reduce(
    (total, grapheme) => total + getCellOccupancy(grapheme),
    0
  );
};
