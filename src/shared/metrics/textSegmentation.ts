import { iterateGraphemes, splitGraphemes } from "@chardesk/protocol";

export { iterateGraphemes, splitGraphemes };

export const getFirstGrapheme = (value: string) =>
  splitGraphemes(value)[0] ?? "";
