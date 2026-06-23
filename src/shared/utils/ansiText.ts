import { getCellOccupancy, splitGraphemes } from "@/shared/metrics";
import type { GridCell } from "@/shared/types";
import {
  parseSgrSequenceAt,
  styleStateToCell,
  type AnsiStyleState,
} from "./ansi";

const DEFAULT_ANSI_TEXT_COLOR = "#ffffff";

export type AnsiTextCell = GridCell & {
  x: number;
  y: number;
};

const parseHyperlinkSequenceAt = (input: string, index: number) => {
  if (!input.startsWith("]8;;", index)) return null;

  const hrefStart = index + 4;
  if (input[hrefStart] === "\\") {
    return { href: "", nextIndex: hrefStart + 1 };
  }
  if (input[hrefStart] === "[" || hrefStart >= input.length) {
    return { href: "", nextIndex: hrefStart };
  }

  const slashEnd = input.indexOf("\\", hrefStart);
  const sgrStart = input.indexOf("[", hrefStart);
  const hasSgrBoundary = sgrStart !== -1 && (slashEnd === -1 || sgrStart < slashEnd);
  const sequenceEnd = hasSgrBoundary ? sgrStart : slashEnd;
  if (sequenceEnd === -1) return null;

  return {
    href: input.slice(hrefStart, sequenceEnd),
    nextIndex: hasSgrBoundary ? sequenceEnd : sequenceEnd + 1,
  };
};

const parseMarkdownLinkAt = (input: string, index: number) => {
  if (input[index] !== "[" || input[index - 1] === "!") return null;

  const labelEnd = input.indexOf("](", index + 1);
  if (labelEnd === -1) return null;

  const hrefStart = labelEnd + 2;
  const hrefEnd = input.indexOf(")", hrefStart);
  if (hrefEnd === -1) return null;

  const label = input.slice(index + 1, labelEnd);
  const href = input.slice(hrefStart, hrefEnd);
  if (!label || !href) return null;

  return {
    label,
    href,
    nextIndex: hrefEnd + 1,
  };
};
export const parseAnsiTextCells = (
  input: string,
  defaultColor = DEFAULT_ANSI_TEXT_COLOR
): AnsiTextCell[] | null => {
  if (!input) return null;

  const cells: AnsiTextCell[] = [];
  let x = 0;
  let y = 0;
  let index = 0;
  const defaultStyle: AnsiStyleState = { color: defaultColor };
  let currentStyle: AnsiStyleState = { color: defaultColor };
  let sawSgrSequence = false;

  const pushStyledText = (text: string, style: AnsiStyleState) => {
    let textIndex = 0;
    while (textIndex < text.length) {
      const char = splitGraphemes(text.slice(textIndex))[0] ?? text[textIndex];
      cells.push({ x, y, ...styleStateToCell(char, style) });
      x += getCellOccupancy(char);
      textIndex += char.length;
    }
  };

  while (index < input.length) {
    const markdownLink = parseMarkdownLinkAt(input, index);
    if (markdownLink) {
      pushStyledText(markdownLink.label, {
        ...currentStyle,
        href: markdownLink.href,
      });
      sawSgrSequence = true;
      index = markdownLink.nextIndex;
      continue;
    }

    const hyperlinkSequence = parseHyperlinkSequenceAt(input, index);
    if (hyperlinkSequence) {
      currentStyle = {
        ...currentStyle,
        ...(hyperlinkSequence.href ? { href: hyperlinkSequence.href } : {}),
      };
      if (!hyperlinkSequence.href) {
        delete currentStyle.href;
      }
      sawSgrSequence = true;
      index = hyperlinkSequence.nextIndex;
      continue;
    }

    const sequence = parseSgrSequenceAt(
      input,
      index,
      currentStyle,
      defaultStyle,
      true
    );
    if (sequence) {
      currentStyle = sequence.style;
      sawSgrSequence ||= sequence.changed;
      index = sequence.nextIndex;
      continue;
    }

    if (input[index] === "\r" && input[index + 1] === "\n") {
      x = 0;
      y += 1;
      index += 2;
      continue;
    }
    if (input[index] === "\n" || input[index] === "\r") {
      x = 0;
      y += 1;
      index += 1;
      continue;
    }

    const char = splitGraphemes(input.slice(index))[0] ?? input[index];
    pushStyledText(char, currentStyle);
    index += char.length;
  }

  return sawSgrSequence && cells.length > 0 ? cells : null;
};
