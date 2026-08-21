import { createCellTextCodec } from "./cell-text.js";
import { defineCharGraphRenderer } from "./index.js";
import { renderMermaidASCII } from "./vendor/ascii/index.js";

export interface MermaidRenderOptions {
  characterSet?: "unicode" | "ascii";
  paddingX?: number;
  paddingY?: number;
  boxBorderPadding?: number;
}

export const renderMermaid = async (
  source: string,
  options: MermaidRenderOptions = {}
) => {
  try {
    const codec = createCellTextCodec();
    const rendered = await renderMermaidASCII(codec.encode(source), {
      useAscii: options.characterSet === "ascii",
      paddingX: options.paddingX,
      paddingY: options.paddingY,
      boxBorderPadding: options.boxBorderPadding,
    });
    return {
      fragments: [{
        text: codec.decode(rendered).replace(/\r\n?/g, "\n"),
        origin: { from: 0, to: source.length },
      }],
      recognized: true,
      diagnostics: [],
    };
  } catch (error) {
    return {
      fragments: [{ text: source, origin: { from: 0, to: source.length } }],
      recognized: true,
      diagnostics: [{
        code: "mermaid-render-failed",
        message: error instanceof Error
          ? `Could not render Mermaid diagram: ${error.message}`
          : "Could not render Mermaid diagram.",
        offset: 0,
        length: source.length,
      }],
    };
  }
};

export const mermaidRenderer = defineCharGraphRenderer<MermaidRenderOptions>({
  id: "mermaid",
  render: renderMermaid,
});
