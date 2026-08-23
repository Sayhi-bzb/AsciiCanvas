import { createCellTextCodec } from "./cell-text.js";
import { defineCharGraphRenderer } from "./index.js";
import type { MermaidStyleMap } from "./mermaid-style.js";
import { renderMermaidSurface } from "./vendor/ascii/index.js";
import { surfaceToStyleRuns } from "./vendor/ascii/surface.js";

export {
  CHARDESK_MERMAID_COLOR_DEFAULTS,
  createCharDeskMermaidStyles,
  MERMAID_STYLE_ROLES,
} from "./mermaid-style.js";
export type {
  CharDeskMermaidStyles,
  MermaidStyleMap,
  MermaidStyleRole,
} from "./mermaid-style.js";

export interface MermaidRenderOptions {
  characterSet?: "unicode" | "ascii";
  paddingX?: number;
  paddingY?: number;
  boxBorderPadding?: number;
  styles?: MermaidStyleMap;
}

export const renderMermaid = async (
  source: string,
  options: MermaidRenderOptions = {}
) => {
  try {
    const codec = createCellTextCodec();
    const rendered = await renderMermaidSurface(codec.encode(source), {
      useAscii: options.characterSet === "ascii",
      paddingX: options.paddingX,
      paddingY: options.paddingY,
      boxBorderPadding: options.boxBorderPadding,
    });
    const runs = surfaceToStyleRuns(rendered);
    const styledFragments = runs.map(({ text, role }) => ({
        text: codec.decode(text).replace(/\r\n?/g, "\n"),
        ...(role ? options.styles?.[role] : undefined),
        origin: { from: 0, to: source.length },
      }));
    if (styledFragments.length === 0) {
      styledFragments.push({
        text: "",
        origin: { from: 0, to: source.length },
      });
    }
    return {
      fragments: options.styles
        ? styledFragments
        : [{
            text: styledFragments.map((fragment) => fragment.text).join(""),
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
