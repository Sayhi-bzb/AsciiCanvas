import { createCellTextCodec } from "./cell-text.js";
import { defineCharGraphRenderer } from "./index.js";
import { renderMermaidASCII } from "./vendor/ascii/index.js";

export interface MermaidTextRenderOptions {
  characterSet?: "unicode" | "ascii";
  paddingX?: number;
  paddingY?: number;
  boxBorderPadding?: number;
}

export const renderMermaidText = (
  source: string,
  options: MermaidTextRenderOptions = {}
): string => {
  const codec = createCellTextCodec();
  const rendered = renderMermaidASCII(codec.encode(source), {
    useAscii: options.characterSet === "ascii",
    paddingX: options.paddingX,
    paddingY: options.paddingY,
    boxBorderPadding: options.boxBorderPadding,
  });
  return codec.decode(rendered).replace(/\r\n?/g, "\n");
};

export const mermaidRenderer = defineCharGraphRenderer<MermaidTextRenderOptions>({
  id: "mermaid",
  render: renderMermaidText,
});
