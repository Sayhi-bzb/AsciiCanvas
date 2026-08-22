import { getCharGraphText } from "./fragments.js";
import {
  createMarkdownRenderer,
  detectMarkdownText as detectMarkdownTextWithExtensions,
  type MarkdownRenderOptions,
} from "./markdown.js";
import { markdownMermaidExtension } from "./markdown-mermaid.js";
import { markdownMathExtension } from "./markdown-math.js";
import { markdownAlertExtension } from "./markdown-alert.js";
import { markdownDiffExtension } from "./markdown-diff.js";
import {
  markdownJsonTreeExtension,
  markdownYamlTreeExtension,
} from "./markdown-data-tree.js";

export * from "./markdown.js";
export * from "./markdown-extension.js";
export { markdownMermaidExtension } from "./markdown-mermaid.js";
export { markdownMathExtension } from "./markdown-math.js";
export { markdownAlertExtension } from "./markdown-alert.js";
export { markdownDiffExtension } from "./markdown-diff.js";
export {
  markdownJsonTreeExtension,
  markdownYamlTreeExtension,
} from "./markdown-data-tree.js";

const defaultExtensions = [
  markdownAlertExtension,
  markdownDiffExtension,
  markdownJsonTreeExtension,
  markdownYamlTreeExtension,
  markdownMathExtension,
  markdownMermaidExtension,
];

export const markdownRenderer = createMarkdownRenderer({
  extensions: defaultExtensions,
});

export const detectMarkdownText = (source: string) =>
  detectMarkdownTextWithExtensions(source, defaultExtensions);

export const renderMarkdown = (
  source: string,
  options: MarkdownRenderOptions = {}
) => markdownRenderer.render(source, options);

export const getMarkdownText = async (
  source: string,
  options: MarkdownRenderOptions = {}
) => getCharGraphText(await renderMarkdown(source, options));
