import { describe, expect, it } from "vitest";
import { DEFAULT_TEXT_RENDER_THEME } from "./theme";
import {
  createDefaultFeatureSettings,
  createRegisteredMarkdownOptions,
  decodeFeatureSettings,
  getTextRenderFeatureDefinition,
  migrateLegacyFeatureSettings,
  TEXT_RENDER_FEATURES,
} from "./features";

describe("text render feature registry", () => {
  it("owns unique feature and local color-slot identities", () => {
    expect(new Set(TEXT_RENDER_FEATURES.map((feature) => feature.id)).size).toBe(
      TEXT_RENDER_FEATURES.length
    );
    for (const feature of TEXT_RENDER_FEATURES) {
      expect(feature.id).toMatch(/^markdown\./);
      expect(new Set(feature.colorSlots.map((slot) => slot.id)).size).toBe(
        feature.colorSlots.length
      );
      expect(getTextRenderFeatureDefinition(feature.id)).toBe(feature);
      expect(Object.isFrozen(feature)).toBe(true);
      expect(feature.colorSlots.every((slot) =>
        Object.isFrozen(slot) && Object.isFrozen(slot.default)
      )).toBe(true);
    }
  });

  it("creates independent defaults for every registered feature", () => {
    const left = createDefaultFeatureSettings();
    const right = createDefaultFeatureSettings();

    expect(Object.keys(left)).toEqual(TEXT_RENDER_FEATURES.map((feature) => feature.id));
    expect(Object.values(left).every((config) => config.enabled)).toBe(true);
    left["markdown.strong"]!.colors.foreground = "#123456";
    expect(right["markdown.strong"]!.colors).toEqual({});
  });

  it("builds core and extension options from the same feature settings", () => {
    const settings = createDefaultFeatureSettings();
    settings["markdown.strong"]!.enabled = false;
    settings["markdown.inline-math"]!.enabled = false;
    settings["markdown.math-style"]!.colors.operator = "#abcdef";
    settings["markdown.mermaid"]!.colors["edge.line"] = "#654321";
    settings["markdown.table"]!.colors["header.background"] = "#123456";

    const options = createRegisteredMarkdownOptions(
      settings,
      DEFAULT_TEXT_RENDER_THEME,
      true
    );

    expect(options.rules?.strong).toBe(false);
    expect(options.extensionRules?.["inline-math"]).toBe(false);
    expect(options.extensionRules?.["math-style"]).toBeUndefined();
    expect(options.extensionStyles?.["math-operator"]?.color).toBe("#abcdef");
    expect(options.extensionStyles?.["math-structure"]?.color).toBe("#94a3b8");
    expect(options.styles?.["table-header"]?.bgColor).toBe("#123456");
    expect(options.extensionRules?.["github-alert"]).toBe(true);
    expect(options.extensionRules?.diff).toBe(true);
    expect(options.extensionRules?.["json-tree"]).toBe(true);
    expect(options.extensionRules?.["yaml-tree"]).toBe(true);
    expect(options.extensionStyles?.["alert-warning"]?.color).toBe("#ca8a04");
    expect(options.extensionStyles?.["diff-added"]).toMatchObject({
      color: "#16a34a",
      bgColor: "#e3f4e9",
    });
    expect(options.extensionStyles?.["diff-deleted"]).toMatchObject({
      color: "#dc2626",
      bgColor: "#fbe5e5",
    });
    expect(options.extensionStyles?.["json-tree-connector"]?.color).toBe("#94a3b8");
    expect(options.extensionStyles?.["json-tree-key"]?.color).toBe("#2563eb");
    expect(options.extensionStyles?.["json-tree-index"]?.color).toBe("#94a3b8");
    expect(options.extensionStyles?.["json-tree-boolean"]?.color).toBe("#ca8a04");
    expect(options.extensionStyles?.["json-tree-null"]?.color).toBe("#94a3b8");
    expect(options.extensionStyles?.["json-tree-empty"]?.color).toBe("#94a3b8");
    expect(options.extensionStyles?.["yaml-tree-string"]?.color).toBe("#16a34a");
    expect(options.extensionStyles?.["yaml-tree-number"]?.color).toBe("#0891b2");
    expect(options.extensionStyles?.["yaml-tree-reference"]?.color).toBe("#0891b2");
    expect(options.extensionStyles?.["mermaid.node.border"]?.color).toBe("#2563eb");
    expect(options.extensionStyles?.["mermaid.edge.line"]?.color).toBe("#654321");
    expect(options.extensionStyles?.["mermaid.node.background"]?.bgColor).toBeUndefined();
    expect(options.extensionStyles?.["mermaid.series.5"]?.color).toBe("#dc2626");
    expect(options.codeTheme).toMatchObject({
      name: expect.stringMatching(/^chardesk-render-/),
    });
    expect(options.forced).toBe(true);
  });

  it("migrates v1 global rule and color keys into feature-local config", () => {
    const settings = migrateLegacyFeatureSettings(
      { strong: false },
      {
        "strong.foreground": "#AABBCC",
        table: "#123456",
        "json-tree.keyword": "#234567",
        "yaml-tree.keyword": "#345678",
        "inline-math.foreground": "#456789",
      }
    );

    expect(settings["markdown.strong"]).toEqual({
      enabled: false,
      colors: { foreground: "#aabbcc" },
    });
    expect(settings["markdown.table"]?.colors).toEqual({
      "header.background": "#123456",
      separator: "#123456",
    });
    expect(settings["markdown.block-math"]?.enabled).toBe(true);
    expect(settings["markdown.math-style"]).toEqual({
      enabled: true,
      colors: { content: "#456789" },
    });
    expect(settings["markdown.github-alert"]?.enabled).toBe(true);
    expect(settings["markdown.diff"]?.enabled).toBe(true);
    expect(settings["markdown.json-tree"]?.enabled).toBe(true);
    expect(settings["markdown.yaml-tree"]?.enabled).toBe(true);
    expect(settings["markdown.json-tree"]?.colors).toMatchObject({
      boolean: "#234567",
      null: "#234567",
      empty: "#234567",
    });
    expect(settings["markdown.yaml-tree"]?.colors).toMatchObject({
      boolean: "#345678",
      null: "#345678",
      empty: "#345678",
      reference: "#345678",
    });
  });

  it("migrates the previous v2 math colors into one shared palette", () => {
    const settings = decodeFeatureSettings({
      "markdown.inline-math": {
        enabled: false,
        colors: { foreground: "#ABCDEF" },
      },
      "markdown.block-math": {
        enabled: true,
        colors: { foreground: "#123456" },
      },
    });

    expect(settings["markdown.inline-math"]).toEqual({
      enabled: false,
      colors: {},
    });
    expect(settings["markdown.block-math"]).toEqual({
      enabled: true,
      colors: {},
    });
    expect(settings["markdown.math-style"]?.colors).toEqual({
      content: "#abcdef",
    });
  });

  it("applies an optional Mermaid node fill behind text and empty cells", () => {
    const settings = createDefaultFeatureSettings();
    settings["markdown.mermaid"]!.colors["node.background"] = "#123456";
    const options = createRegisteredMarkdownOptions(
      settings,
      DEFAULT_TEXT_RENDER_THEME,
      true
    );

    expect(options.extensionStyles?.["mermaid.node.text"]?.bgColor).toBe("#123456");
    expect(options.extensionStyles?.["mermaid.node.background"]?.bgColor).toBe("#123456");
  });

  it("migrates the legacy Mermaid foreground across semantic foreground roles", () => {
    const settings = migrateLegacyFeatureSettings(
      {},
      { "mermaid.foreground": "#123456" }
    );
    const colors = settings["markdown.mermaid"]!.colors;

    expect(colors["node.text"]).toBe("#123456");
    expect(colors["node.border"]).toBe("#123456");
    expect(colors["edge.line"]).toBe("#123456");
    expect(colors["edge.arrow"]).toBe("#123456");
    expect(colors["series.5"]).toBe("#123456");
    expect(colors["node.background"]).toBeUndefined();
  });

  it("publishes validated Mermaid color rows", () => {
    const mermaid = getTextRenderFeatureDefinition("markdown.mermaid")!;
    expect(mermaid.colorRows?.map((row) => row.id)).toEqual([
      "node",
      "edge",
      "label",
      "arrow",
      "container",
      "grid",
      "series",
    ]);
    expect(mermaid.colorRows?.every((row) => row.slotIds.every((slotId) =>
      mermaid.colorSlots.some((slot) => slot.id === slotId)
    ))).toBe(true);
  });

  it("drops retired Mermaid relation colors while preserving current colors", () => {
    const colors = decodeFeatureSettings({
      "markdown.mermaid": {
        enabled: true,
        colors: {
          "relation.1": "#123456",
          "relation.5": "#abcdef",
          "edge.line": "#654321",
        },
      },
    })["markdown.mermaid"]!.colors;

    expect(colors).toEqual({ "edge.line": "#654321" });
  });

  it("decodes the previous v2 Mermaid foreground as semantic colors", () => {
    const colors = decodeFeatureSettings({
      "markdown.mermaid": {
        enabled: true,
        colors: { foreground: "#ABCDEF" },
      },
    })["markdown.mermaid"]!.colors;

    expect(colors["title"]).toBe("#abcdef");
    expect(colors["container.title"]).toBe("#abcdef");
    expect(colors["chart.grid"]).toBe("#abcdef");
    expect(colors["node.background"]).toBeUndefined();
  });

  it("decodes the previous data-tree keyword as semantic value colors", () => {
    const settings = decodeFeatureSettings({
      "markdown.json-tree": {
        enabled: true,
        colors: { keyword: "#ABCDEF" },
      },
      "markdown.yaml-tree": {
        enabled: true,
        colors: { keyword: "#123456" },
      },
    });

    expect(settings["markdown.json-tree"]!.colors).toMatchObject({
      boolean: "#abcdef",
      null: "#abcdef",
      empty: "#abcdef",
    });
    expect(settings["markdown.yaml-tree"]!.colors).toMatchObject({
      boolean: "#123456",
      null: "#123456",
      empty: "#123456",
      reference: "#123456",
    });
    expect(settings["markdown.json-tree"]!.colors.keyword).toBeUndefined();
  });

  it("publishes grouped data-tree color rows", () => {
    const json = getTextRenderFeatureDefinition("markdown.json-tree")!;
    const yaml = getTextRenderFeatureDefinition("markdown.yaml-tree")!;

    expect(json.colorRows?.map((row) => row.id)).toEqual(["structure", "values"]);
    expect(json.colorRows?.[0]?.slotIds).toEqual(["connector", "key", "index"]);
    expect(yaml.colorRows?.[0]?.slotIds).toEqual([
      "connector",
      "key",
      "index",
      "reference",
    ]);
    expect(json.colorRows?.[1]?.slotIds).toEqual([
      "string",
      "number",
      "boolean",
      "null",
      "empty",
    ]);
  });

  it("keeps JSON and YAML tree color overrides independent", () => {
    const settings = createDefaultFeatureSettings();
    settings["markdown.json-tree"]!.colors.boolean = "#111111";
    settings["markdown.yaml-tree"]!.colors.boolean = "#222222";
    settings["markdown.yaml-tree"]!.colors.reference = "#333333";

    const options = createRegisteredMarkdownOptions(
      settings,
      DEFAULT_TEXT_RENDER_THEME,
      true
    );

    expect(options.extensionStyles?.["json-tree-boolean"]?.color).toBe("#111111");
    expect(options.extensionStyles?.["yaml-tree-boolean"]?.color).toBe("#222222");
    expect(options.extensionStyles?.["yaml-tree-reference"]?.color).toBe("#333333");
  });
});
