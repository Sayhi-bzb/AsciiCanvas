import {
  UNICODE_DATA_VERSION,
  WIDE_EAST_ASIAN_RANGES,
} from "./generated/eastAsianWidth.js";

export { UNICODE_DATA_VERSION };

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

export type GraphemeSegment = {
  segment: string;
  index: number;
};

export const iterateGraphemes = (value: string): Iterable<GraphemeSegment> => {
  if (!value) return [];
  if (!segmenter) {
    throw new Error(
      "@chardesk/protocol requires Intl.Segmenter for deterministic grapheme parsing."
    );
  }
  return {
    *[Symbol.iterator]() {
      for (const { segment, index } of segmenter.segment(value)) {
        yield { segment, index };
      }
    },
  };
};

export const segmentGraphemes = (value: string): GraphemeSegment[] =>
  Array.from(iterateGraphemes(value));

export const createGraphemeCursor = (value: string) => {
  const iterator = iterateGraphemes(value)[Symbol.iterator]();
  let current = iterator.next().value;
  const advanceTo = (offset: number) => {
    while (current && current.index + current.segment.length <= offset) {
      current = iterator.next().value;
    }
  };
  return {
    advanceTo,
    take: (offset: number) => {
      advanceTo(offset);
      if (!current) return null;
      const result = {
        segment: current.segment.slice(Math.max(0, offset - current.index)),
        nextIndex: current.index + current.segment.length,
      };
      current = iterator.next().value;
      return result;
    },
  };
};

const EMOJI_PRESENTATION = /\p{Emoji_Presentation}/u;
const EMOJI_MODIFIER = /\p{Emoji_Modifier}/u;
const EXTENDED_PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const REGIONAL_INDICATOR_PAIR = /^\p{Regional_Indicator}{2}$/u;
const KEYCAP_SEQUENCE = /^[#*0-9]\uFE0F?\u20E3$/u;

export const splitGraphemes = (value: string): string[] => {
  return segmentGraphemes(value).map(({ segment }) => segment);
};

export const isEmojiGrapheme = (grapheme: string) => {
  if (KEYCAP_SEQUENCE.test(grapheme)) return true;
  if (REGIONAL_INDICATOR_PAIR.test(grapheme)) return true;
  if (grapheme.includes("\uFE0F")) return true;
  if (EMOJI_MODIFIER.test(grapheme)) return true;
  if (grapheme.includes("\u200D") && EXTENDED_PICTOGRAPHIC.test(grapheme)) {
    return true;
  }
  return EMOJI_PRESENTATION.test(grapheme);
};

const isWideEastAsianCodePoint = (codePoint: number) => {
  let low = 0;
  let high = WIDE_EAST_ASIAN_RANGES.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const range = WIDE_EAST_ASIAN_RANGES[middle];
    if (!range) return false;
    const [start, end] = range;
    if (codePoint < start) high = middle - 1;
    else if (codePoint > end) low = middle + 1;
    else return true;
  }
  return false;
};

export const getGraphemeCellWidth = (grapheme: string): 1 | 2 => {
  if (!grapheme) return 1;
  if (isEmojiGrapheme(grapheme)) return 2;
  const firstCodePoint = grapheme.codePointAt(0) ?? 0;
  return isWideEastAsianCodePoint(firstCodePoint) ? 2 : 1;
};

export const getTextCellWidth = (text: string) => {
  let width = 0;
  for (const { segment } of iterateGraphemes(text)) {
    width += getGraphemeCellWidth(segment);
  }
  return width;
};
