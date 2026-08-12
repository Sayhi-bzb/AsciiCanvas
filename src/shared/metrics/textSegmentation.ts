import { splitGraphemes } from "@chardesk/protocol";

export { splitGraphemes };

export const getFirstGrapheme = (value: string) =>
  splitGraphemes(value)[0] ?? "";
