import { renderCharGraph } from "@chardesk/chargraph";

const MAX_MERMAID_SOURCE_LENGTH = 20_000;
const MAX_MERMAID_SOURCE_LINES = 400;

export const renderMermaidUnicode = async (source: string): Promise<string> => {
  const lineCount = source === "" ? 0 : source.split(/\r\n?|\n/).length;
  if (
    source.length > MAX_MERMAID_SOURCE_LENGTH ||
    lineCount > MAX_MERMAID_SOURCE_LINES
  ) {
    throw new Error(
      `Diagram exceeds the ${MAX_MERMAID_SOURCE_LENGTH}-character or ` +
        `${MAX_MERMAID_SOURCE_LINES}-line limit.`
    );
  }

  const { mermaidRenderer } = await import("@chardesk/chargraph/mermaid");
  return renderCharGraph(source, mermaidRenderer, {
    characterSet: "unicode",
  });
};
