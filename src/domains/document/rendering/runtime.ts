import {
  ansiTextRenderPlugin,
  createMarkdownTextRenderPlugin,
  rawTextRenderPlugin,
} from "./plugins";
import { layoutCharDeskTextRuns } from "@chardesk/protocol";
import { composeTextFragments } from "./compositor";
import type {
  AttributedText,
  MarkdownColorSlotId,
  MarkdownRenderColors,
  MarkdownRenderRules,
  TextRenderPlugin,
  TextRenderFragment,
  TextRenderProfile,
  TextRenderResult,
  TextRendererId,
  TextRenderingStorage,
} from "./types";
import { DEFAULT_TEXT_RENDER_THEME } from "./theme";

export const TEXT_RENDER_PROFILE_STORAGE_KEY = "chardesk-text-render-profile-v1";

export const DEFAULT_TEXT_RENDER_PROFILE: TextRenderProfile = {
  mode: "auto",
  renderTheme: {},
  markdownColors: {},
  markdownRules: {
    strong: true,
    emphasis: true,
    strikethrough: true,
    link: true,
    heading: true,
    "inline-code": true,
    blockquote: true,
    list: true,
    "task-list": true,
    "thematic-break": true,
    "code-block": true,
    mermaid: true,
    table: true,
  },
};

const MARKDOWN_RULE_IDS = [
  "strong",
  "emphasis",
  "strikethrough",
  "link",
  "heading",
  "inline-code",
  "blockquote",
  "list",
  "task-list",
  "thematic-break",
  "code-block",
  "mermaid",
  "table",
] as const;

const MARKDOWN_COLOR_SLOT_IDS = [
  "strong.foreground",
  "emphasis.foreground",
  "strikethrough.foreground",
  "link.foreground",
  "heading.marker",
  "inline-code.foreground",
  "inline-code.background",
  "blockquote.marker",
  "list.marker",
  "task-list.unchecked",
  "task-list.checked",
  "thematic-break.foreground",
  "mermaid.foreground",
  "table.header.foreground",
  "table.header.background",
  "table.separator",
] as const satisfies readonly MarkdownColorSlotId[];

const RENDER_THEME_TOKEN_IDS = Object.keys(DEFAULT_TEXT_RENDER_THEME) as Array<
  keyof typeof DEFAULT_TEXT_RENDER_THEME
>;

const LEGACY_MARKDOWN_COLOR_SLOTS = {
  strong: ["strong.foreground"],
  emphasis: ["emphasis.foreground"],
  strikethrough: ["strikethrough.foreground"],
  link: ["link.foreground"],
  heading: ["heading.marker"],
  "inline-code": ["inline-code.foreground"],
  blockquote: ["blockquote.marker"],
  list: ["list.marker"],
  "thematic-break": ["thematic-break.foreground"],
  mermaid: ["mermaid.foreground"],
  table: ["table.header.background", "table.separator"],
} as const satisfies Record<string, readonly MarkdownColorSlotId[]>;

const normalizeMarkdownColor = (value: unknown) =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : null;

const decodeProfile = (
  value: unknown,
  rendererIds?: ReadonlySet<TextRendererId>
): TextRenderProfile => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_TEXT_RENDER_PROFILE;
  }
  const candidate = value as Partial<TextRenderProfile>;
  const candidateMode = typeof candidate.mode === "string" ? candidate.mode : "";
  const mode = candidateMode === "auto" || rendererIds?.has(candidateMode)
    ? candidateMode
    : DEFAULT_TEXT_RENDER_PROFILE.mode;
  const sourceRules = candidate.markdownRules;
  const markdownRules = Object.fromEntries(
    MARKDOWN_RULE_IDS.map((id) => [
      id,
      typeof sourceRules?.[id] === "boolean"
        ? sourceRules[id]
        : DEFAULT_TEXT_RENDER_PROFILE.markdownRules[id],
    ])
  ) as MarkdownRenderRules;
  const sourceColors = candidate.markdownColors;
  const colorEntries = MARKDOWN_COLOR_SLOT_IDS.flatMap((id) => {
    const color = normalizeMarkdownColor(sourceColors?.[id]);
    return color ? [[id, color] as const] : [];
  });
  Object.entries(LEGACY_MARKDOWN_COLOR_SLOTS).forEach(([legacyId, slots]) => {
    const color = normalizeMarkdownColor((sourceColors as Record<string, unknown> | undefined)?.[legacyId]);
    if (!color) return;
    slots.forEach((slot) => {
      if (!colorEntries.some(([id]) => id === slot)) colorEntries.push([slot, color]);
    });
  });
  const markdownColors = Object.fromEntries(colorEntries) as MarkdownRenderColors;
  const sourceTheme = candidate.renderTheme;
  const renderTheme = Object.fromEntries(
    RENDER_THEME_TOKEN_IDS.flatMap((id) => {
      const color = normalizeMarkdownColor(sourceTheme?.[id]);
      return color ? [[id, color]] : [];
    })
  );
  return {
    mode: mode as TextRenderProfile["mode"],
    renderTheme,
    markdownRules,
    markdownColors,
  };
};

const readProfile = (
  storage: TextRenderingStorage | false | undefined,
  rendererIds: ReadonlySet<TextRendererId>
) => {
  if (!storage) return DEFAULT_TEXT_RENDER_PROFILE;
  try {
    const stored = storage.getItem(TEXT_RENDER_PROFILE_STORAGE_KEY);
    return stored
      ? decodeProfile(JSON.parse(stored), rendererIds)
      : DEFAULT_TEXT_RENDER_PROFILE;
  } catch {
    return DEFAULT_TEXT_RENDER_PROFILE;
  }
};

export class TextRenderingRuntime {
  readonly #plugins = new Map<TextRendererId, TextRenderPlugin>();
  readonly #listeners = new Set<() => void>();
  readonly #storage?: TextRenderingStorage | false;
  #profile: TextRenderProfile;

  constructor(options: {
    storage?: TextRenderingStorage | false;
    plugins?: readonly TextRenderPlugin[];
  } = {}) {
    this.#storage = options.storage;
    this.#profile = DEFAULT_TEXT_RENDER_PROFILE;
    const plugins = options.plugins ?? [
      ansiTextRenderPlugin,
      createMarkdownTextRenderPlugin(),
      rawTextRenderPlugin,
    ];
    plugins.forEach((plugin) => this.register(plugin));
    this.#profile = readProfile(options.storage, new Set(this.#plugins.keys()));
  }

  register = (plugin: TextRenderPlugin) => {
    if (this.#plugins.has(plugin.id)) {
      throw new Error(`Text renderer "${plugin.id}" is already registered.`);
    }
    this.#plugins.set(plugin.id, plugin);
    return () => {
      if (this.#plugins.get(plugin.id) === plugin) this.#plugins.delete(plugin.id);
    };
  };

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  getProfile = () => this.#profile;

  setProfile = (profile: TextRenderProfile) => {
    this.#profile = decodeProfile(profile, new Set(this.#plugins.keys()));
    if (this.#storage) {
      try {
        this.#storage.setItem(TEXT_RENDER_PROFILE_STORAGE_KEY, JSON.stringify(this.#profile));
      } catch {
        // Keep the in-memory preference when browser storage is unavailable.
      }
    }
    this.#listeners.forEach((listener) => listener());
  };

  render = async (source: string, defaultColor: string): Promise<TextRenderResult> => {
    const profile = this.#profile;
    if (profile.mode === "raw") {
      return {
        kind: "plain",
        renderer: "raw",
        pipeline: ["raw"],
        text: source,
        diagnostics: [],
      };
    }

    const context = {
      defaultColor,
      renderTheme: { ...DEFAULT_TEXT_RENDER_THEME, ...profile.renderTheme },
      markdownRules: profile.markdownRules,
      markdownColors: profile.markdownColors,
      forced: profile.mode !== "auto",
    };
    let input: AttributedText = { text: source, spans: [], diagnostics: [] };
    const pipeline: TextRendererId[] = [];

    const decoders = profile.mode === "auto"
      ? [...this.#plugins.values()]
          .filter((plugin) => plugin.phase === "decode" && plugin.autoPriority !== undefined)
          .sort((left, right) => right.autoPriority! - left.autoPriority!)
      : [...this.#plugins.values()].filter(
          (plugin) => plugin.phase === "decode" && plugin.id === profile.mode
        );
    for (const plugin of decoders) {
      if (plugin.phase !== "decode") continue;
      const decoded = await plugin.decode(input.text, context);
      if (!decoded) continue;
      input = {
        text: decoded.text,
        spans: decoded.spans,
        diagnostics: [...input.diagnostics, ...decoded.diagnostics],
      };
      pipeline.push(plugin.id);
      break;
    }

    const transformers = profile.mode === "auto"
      ? [...this.#plugins.values()]
          .filter((plugin) =>
            plugin.phase === "transform" &&
            plugin.id !== "raw" &&
            plugin.autoPriority !== undefined
          )
          .sort((left, right) => right.autoPriority! - left.autoPriority!)
      : [...this.#plugins.values()].filter(
          (plugin) => plugin.phase === "transform" && plugin.id === profile.mode
        );
    let fragments: TextRenderFragment[] | null = null;
    let transformDiagnostics: TextRenderResult["diagnostics"] = [];
    for (const plugin of transformers) {
      if (plugin.phase !== "transform") continue;
      const transformed = await plugin.transform(input, context);
      if (!transformed?.recognized) continue;
      fragments = transformed.fragments;
      transformDiagnostics = transformed.diagnostics;
      pipeline.push(plugin.id);
      break;
    }

    if (pipeline.length === 0) {
      return {
        kind: "plain",
        renderer: "raw",
        pipeline: ["raw"],
        text: source,
        diagnostics: [],
      };
    }

    const resolvedFragments = fragments ?? [{
      text: input.text,
      origin: { from: 0, to: input.text.length },
    }];
    const runs = composeTextFragments(input, resolvedFragments);
    const parsed = layoutCharDeskTextRuns(runs, {
      defaultStyle: { color: defaultColor },
    });
    return {
      kind: "styled",
      renderer: pipeline.at(-1)!,
      pipeline,
      cells: parsed.cells.map((cell) => ({
        x: cell.x,
        y: cell.y,
        char: cell.text,
        color: cell.color ?? defaultColor,
        ...(cell.bgColor ? { bgColor: cell.bgColor } : {}),
        ...(cell.attrs ? { attrs: { ...cell.attrs } } : {}),
        ...(cell.href ? { href: cell.href } : {}),
      })),
      diagnostics: [
        ...input.diagnostics,
        ...transformDiagnostics,
        ...parsed.diagnostics.map((diagnostic) => ({ ...diagnostic })),
      ],
    };
  };
}

export const createTextRenderingRuntime = (
  options?: ConstructorParameters<typeof TextRenderingRuntime>[0]
) => new TextRenderingRuntime(options);

const defaultRuntime = createTextRenderingRuntime();

export const renderTextSource = (source: string, defaultColor: string) =>
  defaultRuntime.render(source, defaultColor);
