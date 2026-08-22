import type { CharDeskTextStyle } from "@chardesk/protocol";
import {
  createMarkdownRenderer,
  markdownAlertExtension,
  markdownJsonTreeExtension,
  markdownDiffExtension,
  markdownMathExtension,
  markdownMermaidExtension,
  markdownYamlTreeExtension,
  type MarkdownRenderOptions,
  type MarkdownSyntaxExtension,
  type MarkdownTextRuleId,
  type MarkdownTextStyles,
} from "@chardesk/chargraph/markdown";
import type { I18nKey } from "@/shared/i18n";
import type {
  TextRenderColorDefault,
  TextRenderFeatureConfig,
  TextRenderFeatureDefinition,
  TextRenderFeatureId,
  TextRenderFeatureSettings,
  TextRenderTheme,
  TextRenderThemeTokenId,
} from "./types";

type InternalColorSlot = TextRenderFeatureDefinition["colorSlots"][number] & {
  readonly legacyIds: readonly string[];
};

type MarkdownFeatureStyles = {
  readonly core?: MarkdownTextStyles;
  readonly extension?: Readonly<Record<string, CharDeskTextStyle>>;
};

type InternalFeatureDefinition = Omit<TextRenderFeatureDefinition, "colorSlots"> & {
  readonly colorSlots: readonly InternalColorSlot[];
  readonly legacyRuleId: string;
  readonly markdown: {
    readonly kind: "core" | "extension";
    readonly ruleId: string;
    readonly extension?: MarkdownSyntaxExtension;
    readonly styles?: (
      color: (slotId: string) => string | undefined,
      theme: TextRenderTheme
    ) => MarkdownFeatureStyles;
  };
};

const inherit = { kind: "inherit" } as const;
const token = (value: TextRenderThemeTokenId) => ({
  kind: "token",
  token: value,
} as const);

const mixHexColors = (foreground: string, background: string, weight: number) => {
  const channel = (value: string, offset: number) => Number.parseInt(value.slice(offset, offset + 2), 16);
  const mixed = [1, 3, 5].map((offset) => Math.round(
    channel(foreground, offset) * weight + channel(background, offset) * (1 - weight)
  ));
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
};

const slot = (
  id: string,
  defaultValue: TextRenderColorDefault,
  legacyIds: readonly string[],
  label?: I18nKey
): InternalColorSlot => ({
  id,
  default: defaultValue,
  legacyIds,
  ...(label ? { label } : {}),
});

const coreFeature = (
  ruleId: MarkdownTextRuleId,
  settingsGroup: "inline" | "blocks",
  label: I18nKey,
  options: {
    colorSlots?: readonly InternalColorSlot[];
    styles?: InternalFeatureDefinition["markdown"]["styles"];
  } = {}
): InternalFeatureDefinition => ({
  id: `markdown.${ruleId}`,
  rendererId: "markdown",
  settingsGroup,
  label,
  defaultEnabled: true,
  colorSlots: options.colorSlots ?? [],
  legacyRuleId: ruleId,
  markdown: {
    kind: "core",
    ruleId,
    ...(options.styles ? { styles: options.styles } : {}),
  },
});

const extensionFeature = (
  ruleId: string,
  settingsGroup: "inline" | "blocks",
  label: I18nKey,
  extension: MarkdownSyntaxExtension,
  options: {
    colorSlots?: readonly InternalColorSlot[];
    styles?: InternalFeatureDefinition["markdown"]["styles"];
  } = {}
): InternalFeatureDefinition => ({
  id: `markdown.${ruleId}`,
  rendererId: "markdown",
  settingsGroup,
  label,
  defaultEnabled: true,
  colorSlots: options.colorSlots ?? [],
  legacyRuleId: ruleId,
  markdown: {
    kind: "extension",
    ruleId,
    extension,
    ...(options.styles ? { styles: options.styles } : {}),
  },
});

const foreground = (
  ruleId: string,
  defaultValue: TextRenderColorDefault = inherit
) => slot("foreground", defaultValue, [`${ruleId}.foreground`, ruleId]);

const dataTreeFeature = (
  ruleId: "json-tree" | "yaml-tree",
  label: I18nKey,
  extension: MarkdownSyntaxExtension
) => extensionFeature(ruleId, "blocks", label, extension, {
  colorSlots: [
    slot("connector", token("muted"), [], "settings.markdown.dataTreeConnector"),
    slot("key", token("accent"), [], "settings.markdown.dataTreeKey"),
    slot("string", token("success"), [], "settings.markdown.dataTreeString"),
    slot("number", token("info"), [], "settings.markdown.dataTreeNumber"),
    slot("keyword", token("warning"), [], "settings.markdown.dataTreeKeyword"),
  ],
  styles: (color) => ({
    extension: {
      [`${ruleId}-connector`]: { color: color("connector") },
      [`${ruleId}-key`]: { color: color("key") },
      [`${ruleId}-string`]: { color: color("string") },
      [`${ruleId}-number`]: { color: color("number") },
      [`${ruleId}-keyword`]: { color: color("keyword") },
    },
  }),
});

const INTERNAL_FEATURES = [
  coreFeature("strong", "inline", "settings.markdown.strong", {
    colorSlots: [foreground("strong")],
    styles: (color) => ({
      core: { strong: { color: color("foreground"), attrs: { bold: true } } },
    }),
  }),
  coreFeature("emphasis", "inline", "settings.markdown.emphasis", {
    colorSlots: [foreground("emphasis")],
    styles: (color) => ({
      core: { emphasis: { color: color("foreground"), attrs: { italic: true } } },
    }),
  }),
  coreFeature("strikethrough", "inline", "settings.markdown.strikethrough", {
    colorSlots: [foreground("strikethrough")],
    styles: (color) => ({
      core: {
        strikethrough: { color: color("foreground"), attrs: { strike: true } },
      },
    }),
  }),
  coreFeature("link", "inline", "settings.markdown.link", {
    colorSlots: [foreground("link", token("info"))],
    styles: (color) => ({
      core: { link: { color: color("foreground"), attrs: { underline: true } } },
    }),
  }),
  coreFeature("inline-code", "inline", "settings.markdown.inlineCode", {
    colorSlots: [
      slot(
        "foreground",
        token("info"),
        ["inline-code.foreground", "inline-code"],
        "settings.markdown.inlineCodeForeground"
      ),
      slot(
        "background",
        token("surface"),
        ["inline-code.background"],
        "settings.markdown.inlineCodeBackground"
      ),
    ],
    styles: (color) => ({
      core: {
        "inline-code": {
          color: color("foreground"),
          bgColor: color("background"),
        },
      },
    }),
  }),
  extensionFeature(
    "inline-math",
    "inline",
    "settings.markdown.inlineMath",
    markdownMathExtension,
    {
      colorSlots: [foreground("inline-math")],
      styles: (color) => ({
        extension: { "inline-math": { color: color("foreground") } },
      }),
    }
  ),
  coreFeature("heading", "blocks", "settings.markdown.heading", {
    colorSlots: [slot("marker", token("accent"), ["heading.marker", "heading"])],
    styles: (color) => ({
      core: {
        "heading-marker": { color: color("marker") },
        "heading-1": { attrs: { bold: true, underline: true } },
        "heading-2": { attrs: { bold: true } },
        "heading-3": { attrs: { bold: true, italic: true } },
        "heading-4": { attrs: { italic: true } },
      },
    }),
  }),
  coreFeature("blockquote", "blocks", "settings.markdown.blockquote", {
    colorSlots: [slot("marker", token("success"), ["blockquote.marker", "blockquote"])],
    styles: (color) => ({
      core: { "blockquote-marker": { color: color("marker") } },
    }),
  }),
  coreFeature("list", "blocks", "settings.markdown.list", {
    colorSlots: [slot(
      "marker",
      { kind: "mixed", tokens: ["accent"], includesInherited: true },
      ["list.marker", "list"]
    )],
    styles: (color, theme) => {
      const marker = color("marker");
      return {
        core: {
          ...(marker ? { "list-marker": { color: marker } } : {}),
          "ordered-list-marker": { color: marker ?? theme.accent },
        },
      };
    },
  }),
  coreFeature("task-list", "blocks", "settings.markdown.taskList", {
    colorSlots: [
      slot(
        "unchecked",
        token("muted"),
        ["task-list.unchecked"],
        "settings.markdown.taskListUnchecked"
      ),
      slot(
        "checked",
        token("success"),
        ["task-list.checked"],
        "settings.markdown.taskListChecked"
      ),
    ],
    styles: (color) => ({
      core: {
        "task-unchecked": { color: color("unchecked") },
        "task-checked": { color: color("checked") },
      },
    }),
  }),
  coreFeature("thematic-break", "blocks", "settings.markdown.thematicBreak", {
    colorSlots: [foreground("thematic-break")],
    styles: (color) => ({
      core: {
        ...(color("foreground")
          ? { "thematic-break": { color: color("foreground") } }
          : {}),
      },
    }),
  }),
  coreFeature("code-block", "blocks", "settings.markdown.codeBlock"),
  extensionFeature(
    "github-alert",
    "blocks",
    "settings.markdown.githubAlert",
    markdownAlertExtension,
    {
      colorSlots: [
        slot("note", token("info"), [], "settings.markdown.alertNote"),
        slot("tip", token("success"), [], "settings.markdown.alertTip"),
        slot("important", token("accent"), [], "settings.markdown.alertImportant"),
        slot("warning", token("warning"), [], "settings.markdown.alertWarning"),
        slot("caution", token("danger"), [], "settings.markdown.alertCaution"),
      ],
      styles: (color) => ({
        extension: {
          "alert-note": { color: color("note") },
          "alert-tip": { color: color("tip") },
          "alert-important": { color: color("important") },
          "alert-warning": { color: color("warning") },
          "alert-caution": { color: color("caution") },
        },
      }),
    }
  ),
  extensionFeature(
    "diff",
    "blocks",
    "settings.markdown.diff",
    markdownDiffExtension,
    {
      colorSlots: [
        slot("added", token("success"), [], "settings.markdown.diffAdded"),
        slot("deleted", token("danger"), [], "settings.markdown.diffDeleted"),
        slot("hunk", token("accent"), [], "settings.markdown.diffHunk"),
        slot("metadata", token("muted"), [], "settings.markdown.diffMetadata"),
      ],
      styles: (color, theme) => {
        const added = color("added") ?? theme.success;
        const deleted = color("deleted") ?? theme.danger;
        return {
          extension: {
            "diff-added": {
              color: added,
              bgColor: mixHexColors(added, theme.background, 0.12),
            },
            "diff-deleted": {
              color: deleted,
              bgColor: mixHexColors(deleted, theme.background, 0.12),
            },
            "diff-hunk": { color: color("hunk") },
            "diff-metadata": { color: color("metadata") },
          },
        };
      },
    }
  ),
  dataTreeFeature(
    "json-tree",
    "settings.markdown.jsonTree",
    markdownJsonTreeExtension
  ),
  dataTreeFeature(
    "yaml-tree",
    "settings.markdown.yamlTree",
    markdownYamlTreeExtension
  ),
  extensionFeature(
    "mermaid",
    "blocks",
    "settings.markdown.mermaid",
    markdownMermaidExtension,
    {
      colorSlots: [foreground("mermaid")],
      styles: (color) => ({
        extension: { mermaid: { color: color("foreground") } },
      }),
    }
  ),
  extensionFeature(
    "block-math",
    "blocks",
    "settings.markdown.blockMath",
    markdownMathExtension,
    {
      colorSlots: [foreground("block-math")],
      styles: (color) => ({
        extension: { "block-math": { color: color("foreground") } },
      }),
    }
  ),
  coreFeature("table", "blocks", "settings.markdown.table", {
    colorSlots: [
      slot(
        "header.foreground",
        token("accent-foreground"),
        ["table.header.foreground"],
        "settings.markdown.tableHeaderForeground"
      ),
      slot(
        "header.background",
        token("accent"),
        ["table.header.background", "table"],
        "settings.markdown.tableHeaderBackground"
      ),
      slot(
        "separator",
        token("muted"),
        ["table.separator", "table"],
        "settings.markdown.tableSeparator"
      ),
    ],
    styles: (color) => ({
      core: {
        "table-header": {
          color: color("header.foreground"),
          bgColor: color("header.background"),
          attrs: { bold: true },
        },
        "table-separator": { color: color("separator") },
      },
    }),
  }),
] as const satisfies readonly InternalFeatureDefinition[];

const featureDefinition = (
  feature: InternalFeatureDefinition
): TextRenderFeatureDefinition => Object.freeze({
  id: feature.id,
  rendererId: feature.rendererId,
  settingsGroup: feature.settingsGroup,
  label: feature.label,
  defaultEnabled: feature.defaultEnabled,
  colorSlots: Object.freeze(feature.colorSlots.map((colorSlot) => {
    const defaultValue = colorSlot.default.kind === "mixed"
      ? Object.freeze({
          ...colorSlot.default,
          tokens: Object.freeze([...colorSlot.default.tokens]),
        })
      : Object.freeze({ ...colorSlot.default });
    return Object.freeze({
      id: colorSlot.id,
      default: defaultValue,
      ...(colorSlot.label ? { label: colorSlot.label } : {}),
    });
  })),
});

export const TEXT_RENDER_FEATURES: readonly TextRenderFeatureDefinition[] =
  Object.freeze(INTERNAL_FEATURES.map(featureDefinition));

const PUBLIC_FEATURES_BY_ID = new Map(
  TEXT_RENDER_FEATURES.map((feature) => [feature.id, feature])
);

export const getTextRenderFeatureDefinition = (id: TextRenderFeatureId) =>
  PUBLIC_FEATURES_BY_ID.get(id);

export const createDefaultFeatureSettings = (): TextRenderFeatureSettings =>
  Object.fromEntries(TEXT_RENDER_FEATURES.map((feature) => [
    feature.id,
    { enabled: feature.defaultEnabled, colors: {} },
  ]));

const normalizeColor = (value: unknown) =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : null;

const decodeColors = (
  value: unknown,
  definition: InternalFeatureDefinition
) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  return Object.fromEntries(definition.colorSlots.flatMap((colorSlot) => {
    const color = normalizeColor(source[colorSlot.id]);
    return color ? [[colorSlot.id, color]] : [];
  }));
};

export const decodeFeatureSettings = (value: unknown): TextRenderFeatureSettings => {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return Object.fromEntries(INTERNAL_FEATURES.map((definition) => {
    const candidate = source[definition.id];
    const record = candidate && typeof candidate === "object" && !Array.isArray(candidate)
      ? candidate as Partial<TextRenderFeatureConfig>
      : {};
    return [definition.id, {
      enabled: typeof record.enabled === "boolean"
        ? record.enabled
        : definition.defaultEnabled,
      colors: decodeColors(record.colors, definition),
    }];
  }));
};

export const migrateLegacyFeatureSettings = (
  rules: unknown,
  colors: unknown
): TextRenderFeatureSettings => {
  const sourceRules = rules && typeof rules === "object" && !Array.isArray(rules)
    ? rules as Record<string, unknown>
    : {};
  const sourceColors = colors && typeof colors === "object" && !Array.isArray(colors)
    ? colors as Record<string, unknown>
    : {};
  return Object.fromEntries(INTERNAL_FEATURES.map((definition) => {
    const migratedColors = Object.fromEntries(definition.colorSlots.flatMap((colorSlot) => {
      for (const legacyId of colorSlot.legacyIds) {
        const color = normalizeColor(sourceColors[legacyId]);
        if (color) return [[colorSlot.id, color]];
      }
      return [];
    }));
    const legacyEnabled = sourceRules[definition.legacyRuleId];
    return [definition.id, {
      enabled: typeof legacyEnabled === "boolean"
        ? legacyEnabled
        : definition.defaultEnabled,
      colors: migratedColors,
    }];
  }));
};

const resolveDefaultColor = (
  value: TextRenderColorDefault,
  theme: TextRenderTheme
) => value.kind === "token" ? theme[value.token] : undefined;

export const createRegisteredMarkdownRenderer = () => {
  const extensions = [...new Set(INTERNAL_FEATURES.flatMap((feature) =>
    feature.markdown.extension ? [feature.markdown.extension] : []
  ))];
  return createMarkdownRenderer({ extensions });
};

export const createRegisteredMarkdownOptions = (
  settings: TextRenderFeatureSettings,
  theme: TextRenderTheme,
  forced: boolean
): MarkdownRenderOptions => {
  const rules: Partial<Record<MarkdownTextRuleId, boolean>> = {};
  const extensionRules: Record<string, boolean> = {};
  const styles: MarkdownTextStyles = {};
  const extensionStyles: Record<string, CharDeskTextStyle> = {};

  for (const definition of INTERNAL_FEATURES) {
    const config = settings[definition.id] ?? {
      enabled: definition.defaultEnabled,
      colors: {},
    };
    if (definition.markdown.kind === "core") {
      rules[definition.markdown.ruleId as MarkdownTextRuleId] = config.enabled;
    } else {
      extensionRules[definition.markdown.ruleId] = config.enabled;
    }
    const color = (slotId: string) => {
      const configured = normalizeColor(config.colors[slotId]);
      if (configured) return configured;
      const colorSlot = definition.colorSlots.find((item) => item.id === slotId);
      return colorSlot ? resolveDefaultColor(colorSlot.default, theme) : undefined;
    };
    const resolved = definition.markdown.styles?.(color, theme);
    Object.assign(styles, resolved?.core);
    Object.assign(extensionStyles, resolved?.extension);
  }

  return { forced, rules, extensionRules, styles, extensionStyles };
};
