import { describe, expect, it } from "vitest";
import { defineCharGraphRenderer, renderCharGraph } from "./index.js";

describe("renderCharGraph", () => {
  it("normalizes synchronous renderer output to LF", async () => {
    const renderer = defineCharGraphRenderer({
      id: "fixture",
      render: () => "A\r\nB\rC",
    });

    await expect(renderCharGraph("source", renderer)).resolves.toBe("A\nB\nC");
  });

  it("supports asynchronous renderers and typed options", async () => {
    const renderer = defineCharGraphRenderer<{ prefix: string }>({
      id: "async-fixture",
      render: async (source, options) => `${options?.prefix ?? ""}${source}`,
    });

    await expect(
      renderCharGraph("graph", renderer, { prefix: "unicode:" })
    ).resolves.toBe("unicode:graph");
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
});
