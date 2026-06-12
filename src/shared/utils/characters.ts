const fallbackGrapheme = (value: string) => {
  return Array.from(value)[0] ?? "";
};

export const getFirstGrapheme = (value: string) => {
  if (!value) return "";

  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    const iterator = segmenter.segment(value)[Symbol.iterator]();
    const first = iterator.next();
    if (!first.done) {
      return first.value.segment;
    }
  }

  return fallbackGrapheme(value);
};

export const normalizeBrushChar = (value: string, fallback: string) => {
  const first = getFirstGrapheme(value);
  return first || fallback;
};
