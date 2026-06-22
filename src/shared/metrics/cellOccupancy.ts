import { splitGraphemes } from "./textSegmentation";

const isEmojiPresentation = (value: string) => {
  return /\p{Emoji_Presentation}/u.test(value);
};

const isCjkOrFullwidth = (codePoint: number) => {
  return (
    (codePoint >= 0x2e80 && codePoint <= 0x9fff) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xff00 && codePoint <= 0xffef)
  );
};

export const getCellOccupancy = (grapheme: string) => {
  if (!grapheme) return 1;

  const firstCodePoint = grapheme.codePointAt(0) ?? 0;
  if (firstCodePoint < 128 && splitGraphemes(grapheme).length === 1) return 1;

  if (
    isEmojiPresentation(grapheme) ||
    isCjkOrFullwidth(firstCodePoint)
  ) {
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
