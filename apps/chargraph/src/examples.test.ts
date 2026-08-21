import { describe, expect, it } from "vitest";
import { CHARGRAPH_EXAMPLES, renderExample } from "./examples";

describe("CharGraph showcase examples", () => {
  it("contains six basic and six advanced examples with unique IDs", () => {
    expect(CHARGRAPH_EXAMPLES).toHaveLength(12);
    expect(new Set(CHARGRAPH_EXAMPLES.map((example) => example.id))).toHaveLength(12);
    expect(CHARGRAPH_EXAMPLES.filter((example) => example.level === "basic")).toHaveLength(6);
    expect(CHARGRAPH_EXAMPLES.filter((example) => example.level === "advanced")).toHaveLength(6);
  });

  it.each(CHARGRAPH_EXAMPLES)("renders $id with the real Mermaid plugin", async (example) => {
    const output = await renderExample(example);

    expect(output.trim()).not.toBe("");
    expect(output).toContain(example.expectedText);
    expect(output).not.toMatch(/[\uE000-\uF8FF]/u);
    expect(output).not.toContain("\r");
    expect(output).not.toContain("\uFFFD");
  });
});
