import { decodeCharDeskTextRuns } from "@chardesk/protocol";
import { describe, expect, it } from "vitest";
import {
  defineCharGraphRenderer,
  getCharGraphText,
  renderCharGraph,
  serializeCharGraphAnsi,
} from "./index.js";

describe("renderCharGraph", () => {
  it("normalizes synchronous renderer output to LF", async () => {
    const renderer = defineCharGraphRenderer({
      id: "fixture",
      render: () => ({
        fragments: [{ text: "A\r\nB\rC" }],
        recognized: true,
        diagnostics: [],
      }),
    });

    const result = await renderCharGraph("source", renderer);
    expect(getCharGraphText(result)).toBe("A\nB\nC");
  });

  it("supports asynchronous renderers and typed options", async () => {
    const renderer = defineCharGraphRenderer<{ prefix: string }>({
      id: "async-fixture",
      render: async (source, options) => ({
        fragments: [{ text: `${options?.prefix ?? ""}${source}` }],
        recognized: true,
        diagnostics: [],
      }),
    });

    const result = await renderCharGraph("graph", renderer, { prefix: "unicode:" });
    expect(getCharGraphText(result)).toBe("unicode:graph");
  });

  it("preserves renderer failures", async () => {
    const renderer = defineCharGraphRenderer({
      id: "broken",
      render: () => {
        throw new Error("invalid source");
      },
    });

    await expect(renderCharGraph("source", renderer)).rejects.toThrow(
      "invalid source"
    );
  });

  it("serializes structured styles and links only at the ANSI boundary", () => {
    const result = {
      fragments: [{
        text: "Docs",
        color: "#0088cc",
        bgColor: "#eeeeee",
        attrs: { bold: true, italic: true } as const,
        href: "https://example.com",
      }],
    };
    const decoded = decodeCharDeskTextRuns(serializeCharGraphAnsi(result), {
      syntax: "ansi",
    });

    expect(decoded.text).toBe("Docs");
    expect(decoded.runs[0]).toMatchObject(result.fragments[0]);
  });
});
