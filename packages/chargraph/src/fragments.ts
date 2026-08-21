import type { CharDeskTextStyle } from "@chardesk/protocol";
import type {
  CharGraphFragment,
  CharGraphRenderResult,
  CharGraphSourceRange,
} from "./model.js";

export const mergeCharGraphStyle = (
  base: CharDeskTextStyle,
  decoration?: CharDeskTextStyle
): CharDeskTextStyle => ({
  ...((decoration?.color ?? base.color)
    ? { color: decoration?.color ?? base.color }
    : {}),
  ...((decoration?.bgColor ?? base.bgColor)
    ? { bgColor: decoration?.bgColor ?? base.bgColor }
    : {}),
  ...((base.attrs || decoration?.attrs)
    ? { attrs: { ...(base.attrs ?? {}), ...(decoration?.attrs ?? {}) } }
    : {}),
});

export const createCharGraphFragment = (
  text: string,
  style: CharDeskTextStyle = {},
  origin?: CharGraphSourceRange,
  href?: string
): CharGraphFragment => ({
  text,
  ...(style.color ? { color: style.color } : {}),
  ...(style.bgColor ? { bgColor: style.bgColor } : {}),
  ...(style.attrs ? { attrs: { ...style.attrs } } : {}),
  ...(href ? { href } : {}),
  ...(origin ? { origin: { ...origin } } : {}),
});

export const createCharGraphTextFragments = (
  text: string,
  style: CharDeskTextStyle,
  origin: CharGraphSourceRange
) => {
  if (!text.includes("\n") || origin.to - origin.from !== text.length) {
    return [createCharGraphFragment(text, style, origin)];
  }
  const output: CharGraphFragment[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "\n") continue;
    if (index > start) {
      output.push(createCharGraphFragment(text.slice(start, index), style, {
        from: origin.from + start,
        to: origin.from + index,
      }));
    }
    output.push(createCharGraphFragment("\n", style, {
      from: origin.from + index,
      to: origin.from + index + 1,
    }));
    start = index + 1;
  }
  if (start < text.length) {
    output.push(createCharGraphFragment(text.slice(start), style, {
      from: origin.from + start,
      to: origin.to,
    }));
  }
  return output;
};

export const styleCharGraphFragments = (
  fragments: readonly CharGraphFragment[],
  decoration?: CharDeskTextStyle,
  href?: string
) => fragments.map((item) => ({
  ...item,
  ...mergeCharGraphStyle(item, decoration),
  ...(href ?? item.href ? { href: href ?? item.href } : {}),
}));

export const getCharGraphText = (
  result: Pick<CharGraphRenderResult, "fragments">
) => result.fragments.map((fragment) => fragment.text).join("");

export const getCharGraphFragmentsText = (
  fragments: readonly CharGraphFragment[]
) => fragments.map((fragment) => fragment.text).join("");

export const splitCharGraphLines = (
  fragments: readonly CharGraphFragment[]
) => {
  const lines: CharGraphFragment[][] = [[]];
  for (const item of fragments) {
    const parts = item.text.split("\n");
    let outputOffset = 0;
    parts.forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part) {
        const exact = item.origin && item.origin.to - item.origin.from === item.text.length;
        lines.at(-1)!.push({
          ...item,
          text: part,
          ...(exact
            ? {
                origin: {
                  from: item.origin!.from + outputOffset,
                  to: item.origin!.from + outputOffset + part.length,
                },
              }
            : {}),
        });
      }
      outputOffset += part.length + (index < parts.length - 1 ? 1 : 0);
    });
  }
  return lines;
};

export const joinCharGraphLines = (
  lines: readonly CharGraphFragment[][],
  separatorOrigin?: CharGraphSourceRange
) => lines.flatMap((line, index) => [
  ...line,
  ...(index < lines.length - 1
    ? [createCharGraphFragment("\n", {}, separatorOrigin)]
    : []),
]);
