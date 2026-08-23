import { createCharGraphFragment } from "./fragments.js";
import {
  type MarkdownExtensionRenderContext,
  type MarkdownSyntaxExtension,
} from "./markdown-extension.js";
import { parseDataTree, renderDataTree, type DataTreeStyles } from "./data-tree.js";

const DATA_TREE_STYLE_SLOT_IDS = [
  "connector",
  "key",
  "index",
  "string",
  "number",
  "boolean",
  "null",
  "empty",
  "reference",
] as const;

export const MARKDOWN_DATA_TREE_STYLE_ROLES = [
  ...DATA_TREE_STYLE_SLOT_IDS.map((role) => `json-tree-${role}` as const),
  ...DATA_TREE_STYLE_SLOT_IDS.map((role) => `yaml-tree-${role}` as const),
] as const;
type MarkdownDataTreeStyleRole =
  typeof MARKDOWN_DATA_TREE_STYLE_ROLES[number];

const fallback = (
  rawSource: string,
  rawOrigin: { from: number; to: number },
  sourceOrigin: { from: number; to: number },
  diagnostics: ReturnType<typeof parseDataTree>["diagnostics"]
) => {
  const text = rawSource.replace(/\n$/, "");
  return {
    fragments: [createCharGraphFragment(text, {}, {
      from: rawOrigin.from,
      to: rawOrigin.from + text.length,
    })],
    recognized: true,
    diagnostics: diagnostics.map((diagnostic) => ({
      ...diagnostic,
      offset: sourceOrigin.from + (diagnostic.offset ?? 0),
    })),
  };
};

const styles = (
  prefix: "json-tree" | "yaml-tree",
  context: MarkdownExtensionRenderContext<MarkdownDataTreeStyleRole>
) => Object.fromEntries(
  DATA_TREE_STYLE_SLOT_IDS.map((role) => [
    role,
    context.style(`${prefix}-${role}`),
  ])
) as DataTreeStyles;

const createDataTreeExtension = ({
  id,
  languages,
  parserLanguage,
}: {
  id: "json-tree" | "yaml-tree";
  languages: readonly string[];
  parserLanguage: "json" | "yaml";
}): MarkdownSyntaxExtension<MarkdownDataTreeStyleRole> => ({
  id,
  fencedLanguages: languages,
  render(request, context) {
    if (request.kind !== "fenced-code") return null;
    if (!context.enabled(id)) return null;
    const language = parserLanguage === "json" && request.language === "jsonc"
      ? "jsonc"
      : parserLanguage;
    const parsed = parseDataTree(request.source, language);
    if (!parsed.documents) {
      return fallback(
        request.rawSource,
        request.rawOrigin,
        request.sourceOrigin,
        parsed.diagnostics
      );
    }
    return {
      fragments: renderDataTree(parsed.documents, request.sourceOrigin, styles(id, context)),
      recognized: true,
      diagnostics: [],
    };
  },
});

export const markdownJsonTreeExtension = createDataTreeExtension({
  id: "json-tree",
  languages: ["json", "jsonc"],
  parserLanguage: "json",
});

export const markdownYamlTreeExtension = createDataTreeExtension({
  id: "yaml-tree",
  languages: ["yaml", "yml"],
  parserLanguage: "yaml",
});
