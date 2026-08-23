import { getCharGraphText } from "./fragments.js";
import {
  createMarkdownRenderer,
  detectMarkdownText as detectMarkdownTextWithExtensions,
  type MarkdownRenderOptions,
} from "./markdown.js";
import { CHARDESK_MARKDOWN_EXTENSIONS } from "./markdown-modules.js";

export * from "./markdown.js";
export * from "./markdown-extension.js";
export * from "./markdown-module.js";
export * from "./markdown-modules.js";
export * from "./markdown-theme.js";
export { markdownMermaidExtension } from "./markdown-mermaid.js";
export { markdownMathExtension } from "./markdown-math.js";
export { markdownAlertExtension } from "./markdown-alert.js";
export { markdownDiffExtension } from "./markdown-diff.js";
export {
  markdownJsonTreeExtension,
  markdownYamlTreeExtension,
} from "./markdown-data-tree.js";

export { CHARDESK_MARKDOWN_EXTENSIONS } from "./markdown-modules.js";

export const markdownRenderer = createMarkdownRenderer({
  extensions: CHARDESK_MARKDOWN_EXTENSIONS,
});

export const detectMarkdownText = (source: string) =>
  detectMarkdownTextWithExtensions(source, CHARDESK_MARKDOWN_EXTENSIONS);

export const renderMarkdown = (
  source: string,
  options: MarkdownRenderOptions = {}
) => markdownRenderer.render(source, options);

export const getMarkdownText = async (
  source: string,
  options: MarkdownRenderOptions = {}
) => getCharGraphText(await renderMarkdown(source, options));
