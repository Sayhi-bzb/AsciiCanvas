import type {
  CharDeskTextAttributes,
  CharDeskTextRun,
} from "@chardesk/protocol";
import type {
  AttributedText,
  TextRenderFragment,
  TextStyle,
  TextStyleSpan,
} from "./types";

const sameAttrs = (
  left?: CharDeskTextAttributes,
  right?: CharDeskTextAttributes
) =>
  left?.bold === right?.bold &&
  left?.italic === right?.italic &&
  left?.underline === right?.underline &&
  left?.strike === right?.strike &&
  left?.inverse === right?.inverse;

const pushRun = (
  runs: CharDeskTextRun[],
  text: string,
  style: TextStyle
) => {
  if (!text) return;
  const previous = runs.at(-1);
  if (
    previous &&
    previous.color === style.color &&
    previous.bgColor === style.bgColor &&
    previous.href === style.href &&
    sameAttrs(previous.attrs, style.attrs)
  ) {
    previous.text += text;
    return;
  }
  runs.push({
    text,
    ...(style.color ? { color: style.color } : {}),
    ...(style.bgColor ? { bgColor: style.bgColor } : {}),
    ...(style.attrs ? { attrs: { ...style.attrs } } : {}),
    ...(style.href ? { href: style.href } : {}),
  });
};

const mergeStyles = (semantic: TextStyle, explicit: TextStyle): TextStyle => ({
  ...((explicit.color ?? semantic.color)
    ? { color: explicit.color ?? semantic.color }
    : {}),
  ...((explicit.bgColor ?? semantic.bgColor)
    ? { bgColor: explicit.bgColor ?? semantic.bgColor }
    : {}),
  ...((semantic.attrs || explicit.attrs)
    ? { attrs: { ...(semantic.attrs ?? {}), ...(explicit.attrs ?? {}) } }
    : {}),
  ...((explicit.href ?? semantic.href)
    ? { href: explicit.href ?? semantic.href }
    : {}),
});

const styleAt = (spans: readonly TextStyleSpan[], offset: number): TextStyle => {
  const style: TextStyle = {};
  for (const span of spans) {
    if (span.from > offset || span.to <= offset) continue;
    Object.assign(style, mergeStyles(style, span));
  }
  return style;
};

export const spansFromRuns = (
  runs: readonly CharDeskTextRun[]
): TextStyleSpan[] => {
  const spans: TextStyleSpan[] = [];
  let offset = 0;
  for (const run of runs) {
    const from = offset;
    offset += run.text.length;
    if (!run.color && !run.bgColor && !run.attrs && !run.href) continue;
    spans.push({
      from,
      to: offset,
      ...(run.color ? { color: run.color } : {}),
      ...(run.bgColor ? { bgColor: run.bgColor } : {}),
      ...(run.attrs ? { attrs: { ...run.attrs } } : {}),
      ...(run.href ? { href: run.href } : {}),
    });
  }
  return spans;
};

export const composeTextFragments = (
  input: AttributedText,
  fragments: readonly TextRenderFragment[]
): CharDeskTextRun[] => {
  const runs: CharDeskTextRun[] = [];
  for (const fragment of fragments) {
    const semantic: TextStyle = {
      ...(fragment.color ? { color: fragment.color } : {}),
      ...(fragment.bgColor ? { bgColor: fragment.bgColor } : {}),
      ...(fragment.attrs ? { attrs: { ...fragment.attrs } } : {}),
      ...(fragment.href ? { href: fragment.href } : {}),
    };
    const origin = fragment.origin;
    if (!origin || origin.to - origin.from !== fragment.text.length) {
      const explicit = origin ? styleAt(input.spans, origin.from) : {};
      pushRun(runs, fragment.text, mergeStyles(semantic, explicit));
      continue;
    }
    const boundaries = new Set([origin.from, origin.to]);
    for (const span of input.spans) {
      const from = Math.max(origin.from, span.from);
      const to = Math.min(origin.to, span.to);
      if (from < to) {
        boundaries.add(from);
        boundaries.add(to);
      }
    }
    const sorted = [...boundaries].sort((left, right) => left - right);
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const from = sorted[index]!;
      const to = sorted[index + 1]!;
      const text = fragment.text.slice(from - origin.from, to - origin.from);
      pushRun(runs, text, mergeStyles(semantic, styleAt(input.spans, from)));
    }
  }
  return runs;
};
