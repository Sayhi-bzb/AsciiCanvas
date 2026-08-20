import {
  ansiTextRenderPlugin,
  createMarkdownTextRenderPlugin,
  rawTextRenderPlugin,
} from "./plugins";
import { layoutCharDeskTextRuns } from "@chardesk/protocol";
import { composeTextFragments } from "./compositor";
import type {
  AttributedText,
  MarkdownColorRuleId,
  MarkdownRenderColors,
  MarkdownRenderRules,
  TextRenderPlugin,
  TextRenderFragment,
  TextRenderProfile,
  TextRenderResult,
  TextRendererId,
  TextRenderingStorage,
} from "./types";

export const TEXT_RENDER_PROFILE_STORAGE_KEY = "chardesk-text-render-profile-v1";

export const DEFAULT_TEXT_RENDER_PROFILE: TextRenderProfile = {
  mode: "auto",
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
    "thematic-break": true,
    "code-block": true,
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
  "thematic-break",
  "code-block",
  "table",
] as const;

const MARKDOWN_COLOR_RULE_IDS = MARKDOWN_RULE_IDS.filter(
  (id): id is MarkdownColorRuleId => id !== "code-block"
);

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
  const markdownColors = Object.fromEntries(
    MARKDOWN_COLOR_RULE_IDS.flatMap((id) => {
      const color = normalizeMarkdownColor(sourceColors?.[id]);
      return color ? [[id, color]] : [];
    })
  ) as MarkdownRenderColors;
  return { mode: mode as TextRenderProfile["mode"], markdownRules, markdownColors };
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
