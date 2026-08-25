import { describe, expect, it } from "vitest";
import {
  BLOCK_LAYOUT_DASHBOARD_EXAMPLE,
  CHARGRAPH_EXAMPLES,
  getExampleClipboardSource,
  type CharGraphExampleKind,
  renderExample,
} from "./examples.js";

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
  it("contains eleven three-level sets and one standalone layout example", () => {
    expect(CHARGRAPH_EXAMPLES).toHaveLength(34);
    expect(new Set(CHARGRAPH_EXAMPLES.map((example) => example.id))).toHaveLength(34);
    expect(CHARGRAPH_EXAMPLES.filter((example) => example.level === "basic")).toHaveLength(11);
    expect(CHARGRAPH_EXAMPLES.filter((example) => example.level === "intermediate"))
      .toHaveLength(11);
    expect(CHARGRAPH_EXAMPLES.filter((example) => example.level === "advanced")).toHaveLength(12);
    expect(
      CHARGRAPH_EXAMPLES.filter((example) => example.kind === "block-layout")
    ).toEqual([BLOCK_LAYOUT_DASHBOARD_EXAMPLE]);
  });

  it("uses English titles and one natural language per basic example", () => {
    const basicExamples = CHARGRAPH_EXAMPLES.filter(
      (example) => example.level === "basic"
    );

    for (const example of basicExamples) {
      expect(example.title).toMatch(/^[\x20-\x7e]+$/);
    }

    const sourceOf = (id: string) =>
      basicExamples.find((example) => example.id === id)?.source ?? "";
    const englishSources = [
      "flowchart",
      "er",
      "markdown-basics",
      "markdown-code",
      "markdown-math",
    ].map(sourceOf);
    const chineseSources = [
      "state",
      "xychart",
      "markdown-structure",
      "markdown-alert",
    ].map(sourceOf);
    const japaneseSources = ["sequence"].map(sourceOf);
    const koreanSources = ["class"].map(sourceOf);

    for (const source of englishSources) {
      expect(source).not.toMatch(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u);
    }
    for (const source of chineseSources) {
      expect(source).toMatch(/\p{Script=Han}/u);
      expect(source).not.toMatch(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u);
    }
    for (const source of japaneseSources) {
      expect(source).toMatch(/[\p{Script=Hiragana}\p{Script=Katakana}]/u);
      expect(source).not.toMatch(/\p{Script=Hangul}/u);
    }
    for (const source of koreanSources) {
      expect(source).toMatch(/\p{Script=Hangul}/u);
      expect(source).not.toMatch(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u);
    }
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

  it("uses canonical type-first syntax for Class attributes", async () => {
    const cases = [
      { id: "class", source: "+string 제목", output: "+제목: string" },
      { id: "class-advanced", source: "+string 标题", output: "+标题: string" },
    ];

    for (const item of cases) {
      const example = CHARGRAPH_EXAMPLES.find(({ id }) => id === item.id);
      expect(example).toBeDefined();
      expect(example!.source).toContain(item.source);
      expect((await renderExample(example!)).text).toContain(item.output);
    }
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
    expect(output.protocolText).toContain("\u001b[38;2;0;0;0m");
    expect(output.protocolText).not.toBe(output.text);
  });

  it("renders the repository and CharGraph easter eggs as links", async () => {
    const cases = [
      {
        id: "markdown-basics",
        label: "CharDesk",
        href: "https://github.com/Sayhi-bzb/CharDesk",
      },
      {
        id: "markdown-alert",
        label: "CharGraph",
        href: "https://chardesk.com/chargraph/",
      },
      {
        id: "block-layout-dashboard",
        label: "All systems operational",
        href: "https://github.com/Sayhi-bzb/CharDesk",
      },
    ];

    for (const item of cases) {
      const example = CHARGRAPH_EXAMPLES.find(({ id }) => id === item.id);
      expect(example).toBeDefined();
      const output = await renderExample(example!);

      expect(output.text).toContain(item.label);
      expect(output.protocolText).toContain(item.href);
    }
  });

  it("uses the real CharGraph Markdown package in the code example", () => {
    const example = CHARGRAPH_EXAMPLES.find(
      ({ id }) => id === "markdown-code"
    );

    expect(example?.source).toContain(
      'from "@chardesk/chargraph/markdown"'
    );
  });

  it("copies Mermaid as a complete fenced block without changing its source", () => {
    const example = CHARGRAPH_EXAMPLES.find(
      (candidate) => candidate.id === "flowchart"
    );
    expect(example).toBeDefined();

    const clipboardSource = getExampleClipboardSource(example!);

    expect(example!.source).not.toContain("```");
    expect(clipboardSource).toBe(`\`\`\`mermaid\n${example!.source}\n\`\`\``);
    expect(clipboardSource.endsWith("```\n")).toBe(false);
  });

  it.each(["markdown-code", "markdown-code-intermediate", "markdown-code-advanced"])(
    "does not duplicate the existing fence for %s",
    (id) => {
      const example = CHARGRAPH_EXAMPLES.find((candidate) => candidate.id === id);
      expect(example).toBeDefined();

      const clipboardSource = getExampleClipboardSource(example!);

      expect(clipboardSource).toBe(example!.source);
      expect(clipboardSource.match(/```/g)).toHaveLength(2);
    }
  );

  it("copies the block layout stream without wrapping or rewriting it", () => {
    const clipboardSource = getExampleClipboardSource(
      BLOCK_LAYOUT_DASHBOARD_EXAMPLE
    );

    expect(clipboardSource).toBe(BLOCK_LAYOUT_DASHBOARD_EXAMPLE.source);
    expect(clipboardSource).toContain("\n|||\n");
    expect(clipboardSource).toContain("\n---\n");
    expect(clipboardSource).toContain("```json");
  });
});
