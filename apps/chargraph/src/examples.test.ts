import { describe, expect, it } from "vitest";
import { CHARGRAPH_EXAMPLES, renderExample } from "./examples";

describe("CharGraph showcase examples", () => {
  it.each(CHARGRAPH_EXAMPLES)("renders $id with the real Mermaid plugin", async (example) => {
    const output = await renderExample(example);

    expect(output).toContain(example.expectedText);
    expect(output).not.toMatch(/[\uE000-\uF8FF]/u);
    expect(output).not.toContain("\r");
  });
});
