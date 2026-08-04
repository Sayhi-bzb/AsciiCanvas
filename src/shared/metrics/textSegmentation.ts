import { splitGraphemes } from "@ascii-canvas/protocol";

export { splitGraphemes };

export const getFirstGrapheme = (value: string) =>
  splitGraphemes(value)[0] ?? "";
