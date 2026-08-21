import { describe, expect, it } from "vitest";
import { DEFAULT_TEXT_RENDER_THEME } from "./theme";
import {
  createDefaultFeatureSettings,
  createRegisteredMarkdownOptions,
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
    settings["markdown.table"]!.colors["header.background"] = "#123456";

    const options = createRegisteredMarkdownOptions(
      settings,
      DEFAULT_TEXT_RENDER_THEME,
      true
    );

    expect(options.rules?.strong).toBe(false);
    expect(options.extensionRules?.["inline-math"]).toBe(false);
    expect(options.styles?.["table-header"]?.bgColor).toBe("#123456");
    expect(options.extensionRules?.["github-alert"]).toBe(true);
    expect(options.extensionRules?.diff).toBe(true);
    expect(options.extensionStyles?.["alert-warning"]?.color).toBe("#ca8a04");
    expect(options.extensionStyles?.["diff-added"]).toMatchObject({
      color: "#16a34a",
      bgColor: "#e3f4e9",
    });
    expect(options.extensionStyles?.["diff-deleted"]).toMatchObject({
      color: "#dc2626",
      bgColor: "#fbe5e5",
    });
    expect(options.forced).toBe(true);
  });

  it("migrates v1 global rule and color keys into feature-local config", () => {
    const settings = migrateLegacyFeatureSettings(
      { strong: false },
      { "strong.foreground": "#AABBCC", table: "#123456" }
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
    expect(settings["markdown.github-alert"]?.enabled).toBe(true);
    expect(settings["markdown.diff"]?.enabled).toBe(true);
  });
});
