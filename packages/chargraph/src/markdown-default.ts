import { getCharGraphText } from "./fragments.js";
import {
  createMarkdownRenderer,
  detectMarkdownText as detectMarkdownTextWithExtensions,
  type MarkdownRenderOptions,
} from "./markdown.js";
import { markdownMermaidExtension } from "./markdown-mermaid.js";

export * from "./markdown.js";
export * from "./markdown-extension.js";
export { markdownMermaidExtension } from "./markdown-mermaid.js";

const defaultExtensions = [markdownMermaidExtension];

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
