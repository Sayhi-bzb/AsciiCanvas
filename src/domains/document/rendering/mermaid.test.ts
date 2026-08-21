import { describe, expect, it } from "vitest";
import { renderMermaidUnicode } from "./mermaid";

describe("renderMermaidUnicode", () => {
  it("rejects oversized diagrams before loading the renderer", async () => {
    const source = Array.from({ length: 401 }, () => "A --> B").join("\n");

    await expect(renderMermaidUnicode(source)).rejects.toThrow(
      "20000-character or 400-line limit"
    );
  });
});
