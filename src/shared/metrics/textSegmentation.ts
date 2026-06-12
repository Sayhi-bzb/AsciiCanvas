const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

export const splitGraphemes = (value: string) => {
  if (!value) return [];

  if (segmenter) {
    return Array.from(segmenter.segment(value), (part) => part.segment);
  }

  return Array.from(value);
};

export const getFirstGrapheme = (value: string) => {
  return splitGraphemes(value)[0] ?? "";
};
