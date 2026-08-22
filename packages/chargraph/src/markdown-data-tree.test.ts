import { describe, expect, it } from "vitest";
import { getCharGraphText } from "./fragments.js";
import {
  markdownJsonTreeExtension,
  markdownYamlTreeExtension,
} from "./markdown-data-tree.js";
import { createMarkdownRenderer } from "./markdown.js";

const renderer = createMarkdownRenderer({
  extensions: [markdownJsonTreeExtension, markdownYamlTreeExtension],
});

describe("Markdown data tree extensions", () => {
  it("renders nested JSON objects, arrays, empty containers, and scalar roles", async () => {
    const rendered = await renderer.render([
      "```json",
      '{"user":{"name":"Ada","roles":["admin","作者"]},"active":true,"score":3,"empty":{}}',
      "```",
    ].join("\n"), {
      extensionStyles: {
        "json-tree-connector": { color: "#111111" },
        "json-tree-key": { color: "#222222" },
        "json-tree-string": { color: "#333333" },
        "json-tree-number": { color: "#444444" },
        "json-tree-keyword": { color: "#555555" },
      },
    });

    expect(getCharGraphText(rendered)).toBe([
      "├─ user",
      "│  ├─ name: \"Ada\"",
      "│  └─ roles",
      "│     ├─ [0]: \"admin\"",
      "│     └─ [1]: \"作者\"",
      "├─ active: true",
      "├─ score: 3",
      "└─ empty: {}",
    ].join("\n"));
    expect(rendered.fragments.find((item) => item.text === "name")?.color).toBe("#222222");
    expect(rendered.fragments.find((item) => item.text === '"Ada"')?.color).toBe("#333333");
    expect(rendered.fragments.find((item) => item.text === "3")?.color).toBe("#444444");
    expect(rendered.fragments.find((item) => item.text === "true")?.color).toBe("#555555");
    expect(rendered.fragments.find((item) => item.text === "name")?.origin).toEqual({
      from: 17,
      to: 23,
    });
  });

  it("supports JSONC comments and trailing commas without weakening strict JSON", async () => {
    const jsonc = await renderer.render("```jsonc\n{ // note\n  \"ok\": true,\n}\n```");
    expect(getCharGraphText(jsonc)).toBe("└─ ok: true");
    expect(jsonc.diagnostics).toEqual([]);

    const strict = await renderer.render("```json\n{\"ok\": true,}\n```");
    expect(getCharGraphText(strict)).toBe("```json\n{\"ok\": true,}\n```");
    expect(strict.diagnostics[0]).toMatchObject({
      code: "markdown-data-tree-parse-failed",
      offset: 20,
    });
  });

  it("renders YAML documents, anchors, aliases, merge keys, and block scalars", async () => {
    const rendered = await renderer.render([
      "```yaml",
      "base: &base",
      "  enabled: true",
      "copy:",
      "  <<: *base",
      "message: |",
      "  hello",
      "  world",
      "---",
      "next: 2",
      "```",
    ].join("\n"));

    expect(getCharGraphText(rendered)).toBe([
      "├─ document [1]",
      "│  ├─ base &base",
      "│  │  └─ enabled: true",
      "│  ├─ copy",
      "│  │  └─ <<: *base",
      '│  └─ message: "hello\\nworld\\n"',
      "└─ document [2]",
      "   └─ next: 2",
    ].join("\n"));
    expect(rendered.diagnostics).toEqual([]);
  });

  it("keeps empty roots compact and rejects unsupported YAML complex keys", async () => {
    expect(getCharGraphText(await renderer.render("```json\n[]\n```"))).toBe("[]");
    expect(getCharGraphText(await renderer.render("```yaml\n{}\n```"))).toBe("{}");

    const invalid = await renderer.render("```yaml\n? [one, two]\n: value\n```");
    expect(getCharGraphText(invalid)).toBe("```yaml\n? [one, two]\n: value\n```");
    expect(invalid.diagnostics[0]?.code).toBe("markdown-data-tree-render-failed");
  });

  it("falls back to Shiki independently when either tree feature is disabled", async () => {
    const json = await renderer.render("```json\n{\"ok\":true}\n```", {
      extensionRules: { "json-tree": false },
    });
    expect(getCharGraphText(json)).toBe('{"ok":true}');
    expect(json.fragments.some((item) => item.color)).toBe(true);

    const yaml = await renderer.render("```yaml\nok: true\n```", {
      extensionRules: { "yaml-tree": false },
    });
    expect(getCharGraphText(yaml)).toBe("ok: true");
    expect(yaml.fragments.some((item) => item.color)).toBe(true);
  });

  it("preserves complete fences when code blocks are disabled", async () => {
    const rendered = await renderer.render("```json\n{\"ok\":true}\n```", {
      rules: { "code-block": false },
    });
    expect(getCharGraphText(rendered)).toBe("```json\n{\"ok\":true}\n```");
  });

  it("bounds source size, node count, and nesting depth", async () => {
    const oversizedSource = `\`\`\`json\n${JSON.stringify("x".repeat(20_001))}\n\`\`\``;
    const oversized = await renderer.render(oversizedSource);
    expect(getCharGraphText(oversized)).toBe(oversizedSource);
    expect(oversized.diagnostics[0]?.code).toBe("markdown-data-tree-limit-exceeded");

    const crowdedSource = `\`\`\`json\n${JSON.stringify(Array.from({ length: 2_001 }, () => 0))}\n\`\`\``;
    const crowded = await renderer.render(crowdedSource);
    expect(getCharGraphText(crowded)).toBe(crowdedSource);
    expect(crowded.diagnostics[0]?.message).toContain("2000-node");

    const deepData = `${'{"x":'.repeat(65)}0${"}".repeat(65)}`;
    const deepSource = `\`\`\`json\n${deepData}\n\`\`\``;
    const deep = await renderer.render(deepSource);
    expect(getCharGraphText(deep)).toBe(deepSource);
    expect(deep.diagnostics[0]?.message).toContain("64-level");
  });
});
