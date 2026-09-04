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
const GRAPHEME_METRICS_CACHE_LIMIT = 4_096;

type GraphemeMetrics = {
  emoji: boolean;
  width: 1 | 2;
};

const SINGLE_CELL_TEXT_METRICS: GraphemeMetrics = { emoji: false, width: 1 };
const graphemeMetricsCache = new Map<string, GraphemeMetrics>();

export const splitGraphemes = (value: string): string[] => {
  return segmentGraphemes(value).map(({ segment }) => segment);
};

const classifyEmojiGrapheme = (grapheme: string) => {
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

const resolveGraphemeMetrics = (grapheme: string): GraphemeMetrics => {
  if (!grapheme || (grapheme.length === 1 && grapheme.charCodeAt(0) <= 0x7f)) {
    return SINGLE_CELL_TEXT_METRICS;
  }
  const cached = graphemeMetricsCache.get(grapheme);
  if (cached) return cached;

  const emoji = classifyEmojiGrapheme(grapheme);
  const firstCodePoint = grapheme.codePointAt(0) ?? 0;
  const metrics: GraphemeMetrics = {
    emoji,
    width: emoji || isWideEastAsianCodePoint(firstCodePoint) ? 2 : 1,
  };
  if (graphemeMetricsCache.size >= GRAPHEME_METRICS_CACHE_LIMIT) {
    const oldest = graphemeMetricsCache.keys().next().value;
    if (oldest !== undefined) graphemeMetricsCache.delete(oldest);
  }
  graphemeMetricsCache.set(grapheme, metrics);
  return metrics;
};

export const isEmojiGrapheme = (grapheme: string) =>
  resolveGraphemeMetrics(grapheme).emoji;

export const getGraphemeCellWidth = (grapheme: string): 1 | 2 =>
  resolveGraphemeMetrics(grapheme).width;

export const getTextCellWidth = (text: string) => {
  let width = 0;
  for (const { segment } of iterateGraphemes(text)) {
    width += getGraphemeCellWidth(segment);
  }
  return width;
};
