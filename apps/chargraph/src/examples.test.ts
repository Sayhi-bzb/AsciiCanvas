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
  it("contains eleven three-level example sets with unique IDs", () => {
    expect(CHARGRAPH_EXAMPLES).toHaveLength(33);
    expect(new Set(CHARGRAPH_EXAMPLES.map((example) => example.id))).toHaveLength(33);
    expect(CHARGRAPH_EXAMPLES.filter((example) => example.level === "basic")).toHaveLength(11);
    expect(CHARGRAPH_EXAMPLES.filter((example) => example.level === "intermediate"))
      .toHaveLength(11);
    expect(CHARGRAPH_EXAMPLES.filter((example) => example.level === "advanced")).toHaveLength(11);
  });

  it.each(KINDS)("contains basic, intermediate, and advanced %s examples", (kind) => {
    const examples = CHARGRAPH_EXAMPLES.filter((example) => example.kind === kind);

    expect(examples.map((example) => example.level)).toEqual([
      "basic",
      "intermediate",
      "advanced",
    ]);
    expect(examples.every((example) => example.title.trim().length > 0)).toBe(true);
    expect(new Set(examples.map((example) => example.title))).toHaveLength(3);
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

    if (example.renderer === "mermaid") {
      expect(output.protocolText).toContain("\u001b[");
    }
  });

  it("renders JSON trees with the shared Canvas semantic colors", async () => {
    const example = CHARGRAPH_EXAMPLES.find(
      (candidate) => candidate.id === "markdown-code-intermediate"
    );
    expect(example).toBeDefined();

    const output = await renderExample(example!);

    expect(output.protocolText).toContain("\u001b[38;2;37;99;235m");
    expect(output.protocolText).toContain("\u001b[38;2;22;163;74m");
    expect(output.protocolText).toContain("\u001b[38;2;148;163;184m");
  });

  it("renders Mermaid with the shared Renderer Theme", async () => {
    const example = CHARGRAPH_EXAMPLES.find(
      (candidate) => candidate.id === "flowchart"
    );
    expect(example).toBeDefined();

    const output = await renderExample(example!);

    expect(output.protocolText).toContain("\u001b[38;2;37;99;235m");
    expect(output.protocolText).toContain("\u001b[38;2;148;163;184m");
    expect(output.protocolText).not.toBe(output.text);
  });
});
