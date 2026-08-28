import { createCellTextCodec } from "./cell-text.js";
import { defineCharGraphRenderer } from "./model.js";
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

const normalizeStructuralStyles = (
  styles: MermaidStyleMap | undefined,
): MermaidStyleMap | undefined => {
  if (!styles) return undefined;
  const structural = styles["node.border"]
    ?? styles["flow.node.border"]
    ?? styles["edge.line"]
    ?? styles["edge.arrow"];
  return {
    ...styles,
    ...(structural
      ? {
          "node.border": structural,
          "flow.node.border": structural,
          "edge.line": structural,
          "edge.arrow": structural,
        }
      : {}),
  };
};

export const renderMermaid = async (
  source: string,
  options: MermaidRenderOptions = {}
) => {
  try {
    const styles = normalizeStructuralStyles(options.styles);
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
        ...(role ? styles?.[role] : undefined),
        origin: { from: 0, to: source.length },
      }));
    if (styledFragments.length === 0) {
      styledFragments.push({
        text: "",
        origin: { from: 0, to: source.length },
      });
    }
    return {
      fragments: styles
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
          ? `Mermaid source preserved: ${error.message}`
          : "Mermaid source preserved: rendering failed.",
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
