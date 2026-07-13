import type { Point, TextAttributes } from "@/shared/types";
import type {
  StructuredNodeStyle,
  StructuredTextNode,
  StructuredTextRangeStyle,
  StructuredTextStyleRange,
} from "./types";
import { splitGraphemes } from "@/shared/metrics";
import {
  createTextLayout,
  getTextLayoutCaretPoint,
  getTextLayoutOffsetAtPoint,
} from "./text-layout";
import { cloneTextAttributes } from "@/shared/utils/ansi";

export type StructuredTextSelection = {
  nodeId: string;
  anchor: number;
  focus: number;
};

export const normalizeStructuredTextSelection = (
  selection: StructuredTextSelection | null,
  textLength: number
) => {
  if (!selection) return null;
  const anchor = Math.max(0, Math.min(textLength, selection.anchor));
  const focus = Math.max(0, Math.min(textLength, selection.focus));
  return { ...selection, anchor, focus };
};

export const getStructuredTextSelectionRange = (
  selection: StructuredTextSelection | null
) => {
  if (!selection || selection.anchor === selection.focus) return null;
  return {
    start: Math.min(selection.anchor, selection.focus),
    end: Math.max(selection.anchor, selection.focus),
  };
};

export const getStructuredTextSlice = (
  node: StructuredTextNode,
  start: number,
  end: number
) => {
  const chars = splitGraphemes(node.text);
  const rangeStart = Math.max(0, Math.min(chars.length, start));
  const rangeEnd = Math.max(rangeStart, Math.min(chars.length, end));
  return chars.slice(rangeStart, rangeEnd).join("");
};

const cloneRangeStyle = (
  style: StructuredTextRangeStyle
): StructuredTextRangeStyle => ({
  ...(style.color ? { color: style.color } : {}),
  ...(style.bgColor ? { bgColor: style.bgColor } : {}),
  ...(cloneTextAttributes(style.attrs)
    ? { attrs: cloneTextAttributes(style.attrs) }
    : {}),
});

export const cloneStructuredTextStyleRanges = (
  ranges?: StructuredTextStyleRange[]
) => {
  if (!ranges) return undefined;
  const next = ranges
    .map((range) => ({
      start: range.start,
      end: range.end,
      style: cloneRangeStyle(range.style),
    }))
    .filter((range) => range.start < range.end);
  return next.length > 0 ? next : undefined;
};

export const normalizeStructuredTextStyleRanges = (
  ranges: StructuredTextStyleRange[] | undefined,
  textLength: number
) => {
  const cloned = cloneStructuredTextStyleRanges(ranges);
  if (!cloned) return undefined;
  const normalized = cloned
    .map((range) => ({
      ...range,
      start: Math.max(0, Math.min(textLength, range.start)),
      end: Math.max(0, Math.min(textLength, range.end)),
    }))
    .filter((range) => range.start < range.end);
  return normalized.length > 0 ? normalized : undefined;
};

export const mergeStructuredTextStyle = (
  baseStyle: StructuredNodeStyle,
  ranges: StructuredTextStyleRange[] | undefined,
  offset: number
): StructuredNodeStyle => {
  let style: StructuredNodeStyle = {
    color: baseStyle.color,
    ...(baseStyle.bgColor ? { bgColor: baseStyle.bgColor } : {}),
    ...(cloneTextAttributes(baseStyle.attrs)
      ? { attrs: cloneTextAttributes(baseStyle.attrs) }
      : {}),
  };
  ranges?.forEach((range) => {
    if (offset < range.start || offset >= range.end) return;
    const attrs = cloneTextAttributes({
      ...(style.attrs ?? {}),
      ...(range.style.attrs ?? {}),
    });
    style = {
      ...style,
      ...(range.style.color ? { color: range.style.color } : {}),
      ...(range.style.bgColor ? { bgColor: range.style.bgColor } : {}),
      ...(attrs ? { attrs } : {}),
    };
  });
  return style;
};

export const applyStructuredTextRangeStyle = (
  node: StructuredTextNode,
  start: number,
  end: number,
  style: StructuredTextRangeStyle
): StructuredTextNode => {
  const textLength = splitGraphemes(node.text).length;
  const rangeStart = Math.max(0, Math.min(textLength, start));
  const rangeEnd = Math.max(0, Math.min(textLength, end));
  if (rangeStart >= rangeEnd) return node;

  const styleRange: StructuredTextStyleRange = {
    start: rangeStart,
    end: rangeEnd,
    style: cloneRangeStyle(style),
  };
  return {
    ...node,
    styleRanges: normalizeStructuredTextStyleRanges(
      [...(node.styleRanges ?? []), styleRange],
      textLength
    ),
  };
};

const hasRangeStyle = (style: StructuredTextRangeStyle) =>
  !!style.color || !!style.bgColor || !!cloneTextAttributes(style.attrs);

const mergeRangeStyle = (
  base: StructuredTextRangeStyle,
  override: StructuredTextRangeStyle
): StructuredTextRangeStyle => {
  const attrs = cloneTextAttributes({
    ...(base.attrs ?? {}),
    ...(override.attrs ?? {}),
  });
  return {
    ...(base.color ? { color: base.color } : {}),
    ...(base.bgColor ? { bgColor: base.bgColor } : {}),
    ...(override.color ? { color: override.color } : {}),
    ...(override.bgColor ? { bgColor: override.bgColor } : {}),
    ...(attrs ? { attrs } : {}),
  };
};

const stylesEqual = (
  a: StructuredTextRangeStyle,
  b: StructuredTextRangeStyle
) =>
  a.color === b.color &&
  a.bgColor === b.bgColor &&
  !!a.attrs?.bold === !!b.attrs?.bold &&
  !!a.attrs?.italic === !!b.attrs?.italic &&
  !!a.attrs?.underline === !!b.attrs?.underline &&
  !!a.attrs?.strike === !!b.attrs?.strike;

const pushRange = (
  ranges: StructuredTextStyleRange[],
  range: StructuredTextStyleRange
) => {
  if (range.start >= range.end || !hasRangeStyle(range.style)) return;
  const style = cloneRangeStyle(range.style);
  const last = ranges[ranges.length - 1];
  if (last && last.end === range.start && stylesEqual(last.style, style)) {
    last.end = range.end;
    return;
  }
  ranges.push({ start: range.start, end: range.end, style });
};

const getEffectiveRangeStyleAt = (
  ranges: StructuredTextStyleRange[] | undefined,
  offset: number
) => {
  let style: StructuredTextRangeStyle = {};
  ranges?.forEach((range) => {
    if (offset < range.start || offset >= range.end) return;
    style = mergeRangeStyle(style, range.style);
  });
  return style;
};

export const updateStructuredTextStyleRanges = (
  ranges: StructuredTextStyleRange[] | undefined,
  start: number,
  end: number,
  update: (style: StructuredTextRangeStyle) => StructuredTextRangeStyle
) => {
  if (start >= end) return cloneStructuredTextStyleRanges(ranges);

  const next: StructuredTextStyleRange[] = [];
  ranges?.forEach((range) => {
    if (range.end <= start || range.start >= end) {
      pushRange(next, { ...range, style: cloneRangeStyle(range.style) });
      return;
    }
    if (range.start < start) {
      pushRange(next, {
        start: range.start,
        end: start,
        style: cloneRangeStyle(range.style),
      });
    }
    if (range.end > end) {
      pushRange(next, {
        start: end,
        end: range.end,
        style: cloneRangeStyle(range.style),
      });
    }
  });

  const boundaries = new Set([start, end]);
  ranges?.forEach((range) => {
    if (range.end <= start || range.start >= end) return;
    boundaries.add(Math.max(start, range.start));
    boundaries.add(Math.min(end, range.end));
  });
  const sortedBoundaries = [...boundaries].sort((a, b) => a - b);
  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    const segmentStart = sortedBoundaries[i];
    const segmentEnd = sortedBoundaries[i + 1];
    const updatedStyle = update(
      getEffectiveRangeStyleAt(ranges, segmentStart)
    );
    pushRange(next, {
      start: segmentStart,
      end: segmentEnd,
      style: updatedStyle,
    });
  }

  const sorted = next.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: StructuredTextStyleRange[] = [];
  sorted.forEach((range) => pushRange(merged, range));
  return merged.length > 0 ? merged : undefined;
};

export const getStructuredTextStyleRangesInRange = (
  ranges: StructuredTextStyleRange[] | undefined,
  start: number,
  end: number
) => {
  if (start >= end) return undefined;
  const next: StructuredTextStyleRange[] = [];
  ranges?.forEach((range) => {
    const rangeStart = Math.max(start, range.start);
    const rangeEnd = Math.min(end, range.end);
    if (rangeStart >= rangeEnd) return;
    pushRange(next, {
      start: rangeStart - start,
      end: rangeEnd - start,
      style: cloneRangeStyle(range.style),
    });
  });
  return next.length > 0 ? next : undefined;
};

export const replaceStructuredTextRange = (
  node: StructuredTextNode,
  start: number,
  end: number,
  insertText: string,
  insertStyleRanges?: StructuredTextStyleRange[]
): StructuredTextNode => {
  const chars = splitGraphemes(node.text);
  const rangeStart = Math.max(0, Math.min(chars.length, start));
  const rangeEnd = Math.max(rangeStart, Math.min(chars.length, end));
  const insertChars = splitGraphemes(insertText);
  const insertLength = insertChars.length;
  const removedLength = rangeEnd - rangeStart;
  const delta = insertLength - removedLength;
  const nextText = [
    ...chars.slice(0, rangeStart),
    ...insertChars,
    ...chars.slice(rangeEnd),
  ].join("");

  const nextRanges: StructuredTextStyleRange[] = [];
  node.styleRanges?.forEach((range) => {
    if (range.end <= rangeStart) {
      pushRange(nextRanges, { ...range, style: cloneRangeStyle(range.style) });
      return;
    }
    if (range.start >= rangeEnd) {
      pushRange(nextRanges, {
        start: range.start + delta,
        end: range.end + delta,
        style: cloneRangeStyle(range.style),
      });
      return;
    }
    if (range.start < rangeStart) {
      pushRange(nextRanges, {
        start: range.start,
        end: rangeStart,
        style: cloneRangeStyle(range.style),
      });
    }
    if (range.end > rangeEnd) {
      pushRange(nextRanges, {
        start: rangeStart + insertLength,
        end: range.end + delta,
        style: cloneRangeStyle(range.style),
      });
    }
  });

  insertStyleRanges?.forEach((range) => {
    const rangeStartOffset = Math.max(0, Math.min(insertLength, range.start));
    const rangeEndOffset = Math.max(rangeStartOffset, Math.min(insertLength, range.end));
    pushRange(nextRanges, {
      start: rangeStart + rangeStartOffset,
      end: rangeStart + rangeEndOffset,
      style: cloneRangeStyle(range.style),
    });
  });

  return {
    ...node,
    text: nextText,
    styleRanges: normalizeStructuredTextStyleRanges(
      nextRanges,
      splitGraphemes(nextText).length
    ),
  };
};

export const getStructuredTextOffsetAtPoint = (
  node: StructuredTextNode,
  point: Point
) => {
  return getTextLayoutOffsetAtPoint(
    createTextLayout(node.text, node.position),
    point
  );
};

export const getStructuredTextCaretPoint = (
  node: StructuredTextNode,
  offset: number
): Point => {
  return getTextLayoutCaretPoint(createTextLayout(node.text, node.position), offset);
};

export const getStructuredTextStylesInRange = (
  node: StructuredTextNode,
  start: number,
  end: number
) => {
  const styles: StructuredNodeStyle[] = [];
  for (let offset = start; offset < end; offset++) {
    styles.push(mergeStructuredTextStyle(node.style, node.styleRanges, offset));
  }
  return styles;
};

export const setTextAttribute = (
  attrs: TextAttributes | undefined,
  name: keyof TextAttributes,
  enabled: boolean
) => {
  const next = { ...(attrs ?? {}) };
  if (enabled) next[name] = true;
  else delete next[name];
  return cloneTextAttributes(next);
};
