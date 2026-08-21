import type {
  CharDeskTextAttributes,
  CharDeskTextStyle,
} from "@chardesk/protocol";
import type { CharGraphRenderResult } from "./model.js";

const ESC = "\u001b";

const parseHex = (value?: string) => {
  const match = value?.match(/^#([0-9a-f]{6})$/i);
  if (!match) return null;
  const hex = match[1]!;
  return [0, 2, 4].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16)
  );
};

const attrsCodes = (attrs?: CharDeskTextAttributes) => [
  ...(attrs?.bold ? ["1"] : []),
  ...(attrs?.italic ? ["3"] : []),
  ...(attrs?.underline ? ["4"] : []),
  ...(attrs?.inverse ? ["7"] : []),
  ...(attrs?.strike ? ["9"] : []),
];

const styleCodes = (style: CharDeskTextStyle) => {
  const codes = attrsCodes(style.attrs);
  const foreground = parseHex(style.color);
  if (foreground) codes.push(`38;2;${foreground.join(";")}`);
  const background = parseHex(style.bgColor);
  if (background) codes.push(`48;2;${background.join(";")}`);
  return codes;
};

export const serializeCharGraphAnsi = (
  result: Pick<CharGraphRenderResult, "fragments">
) => {
  let output = "";
  for (const fragment of result.fragments) {
    const codes = styleCodes(fragment);
    if (codes.length) output += `${ESC}[${codes.join(";")}m`;
    if (fragment.href) output += `${ESC}]8;;${fragment.href}${ESC}\\`;
    output += fragment.text;
    if (fragment.href) output += `${ESC}]8;;${ESC}\\`;
    if (codes.length) output += `${ESC}[0m`;
  }
  return output;
};
