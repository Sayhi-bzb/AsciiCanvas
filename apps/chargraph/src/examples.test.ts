import { describe, expect, it } from "vitest";
import {
  CHARGRAPH_EXAMPLES,
  type CharGraphExampleKind,
  renderExample,
} from "./examples";

const KINDS: readonly CharGraphExampleKind[] = [
  "flowchart",
  "state",
  "sequence",
  "class",
  "er",
  "xychart",
  "markdown-basics",
  "markdown-structure",
  "markdown-code",
  "markdown-alert",
  "markdown-math",
];

describe("CharGraph showcase examples", () => {
  it("contains eleven basic and advanced example pairs with unique IDs", () => {
    expect(CHARGRAPH_EXAMPLES).toHaveLength(22);
    expect(new Set(CHARGRAPH_EXAMPLES.map((example) => example.id))).toHaveLength(22);
    expect(CHARGRAPH_EXAMPLES.filter((example) => example.level === "basic")).toHaveLength(11);
    expect(CHARGRAPH_EXAMPLES.filter((example) => example.level === "advanced")).toHaveLength(11);
  });

  it.each(KINDS)("contains a basic and advanced %s example", (kind) => {
    const examples = CHARGRAPH_EXAMPLES.filter((example) => example.kind === kind);

    expect(examples.map((example) => example.level)).toEqual(["basic", "advanced"]);
    expect(examples[0]?.detail).toBeUndefined();
    expect(examples[1]?.detail).toBeTruthy();
  });

  it.each(CHARGRAPH_EXAMPLES)("renders $id with its real renderer", async (example) => {
    const output = await renderExample(example);

    expect(output.text.trim()).not.toBe("");
    expect(output.text.trim()).not.toBe(example.source.trim());
    expect(output.text).toContain(example.expectedText);
    expect(output.text).not.toMatch(/[\uE000-\uF8FF]/u);
    expect(output.text).not.toContain("\r");
    expect(output.text).not.toContain("\u001b");
    expect(output.text).not.toContain("\uFFFD");

    if (example.renderer === "markdown") {
      expect(output.syntax).toBe("ansi");
      expect(output.source).toContain("\u001b[");
    } else {
      expect(output).toMatchObject({ syntax: "plain", source: output.text });
    }
  });
});
