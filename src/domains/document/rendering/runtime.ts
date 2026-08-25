import {
  ansiTextRenderPlugin,
  createMarkdownTextRenderPlugin,
  rawTextRenderPlugin,
} from "./plugins";
import {
  layoutCharDeskTextRunsToRows,
  materializeCharDeskTextRows,
} from "@chardesk/protocol";
import { composeTextFragments } from "./compositor";
import {
  createDefaultFeatureSettings,
  decodeFeatureSettings,
  migrateLegacyFeatureSettings,
} from "./features";
import type {
  AttributedText,
  CompactTextRenderResult,
  TextRenderPlugin,
  TextRenderFragment,
  TextRenderProfile,
  TextRenderResult,
  TextRendererId,
  RenderedTextSpan,
  TextRenderingStorage,
  TextTransformResult,
} from "./types";
import { DEFAULT_TEXT_RENDER_THEME } from "./theme";
import { parseBlockLayout } from "@chardesk/chargraph/experimental/block-layout";

export const TEXT_RENDER_PROFILE_STORAGE_KEY = "chardesk-text-render-profile-v2";
const LEGACY_TEXT_RENDER_PROFILE_STORAGE_KEY = "chardesk-text-render-profile-v1";

export const DEFAULT_TEXT_RENDER_PROFILE: TextRenderProfile = {
  mode: "auto",
  renderTheme: {},
  features: createDefaultFeatureSettings(),
};

const RENDER_THEME_TOKEN_IDS = Object.keys(DEFAULT_TEXT_RENDER_THEME) as Array<
  keyof typeof DEFAULT_TEXT_RENDER_THEME
>;

const normalizeColor = (value: unknown) =>
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
  const sourceTheme = candidate.renderTheme;
  const renderTheme = Object.fromEntries(
    RENDER_THEME_TOKEN_IDS.flatMap((id) => {
      const color = normalizeColor(sourceTheme?.[id]);
      return color ? [[id, color]] : [];
    })
  );
  return {
    mode: mode as TextRenderProfile["mode"],
    renderTheme,
    features: decodeFeatureSettings(candidate.features),
  };
};

const migrateLegacyProfile = (
  value: unknown,
  rendererIds: ReadonlySet<TextRendererId>
): TextRenderProfile => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_TEXT_RENDER_PROFILE;
  }
  const candidate = value as Record<string, unknown>;
  return decodeProfile({
    mode: candidate.mode,
    renderTheme: candidate.renderTheme,
    features: migrateLegacyFeatureSettings(
      candidate.markdownRules,
      candidate.markdownColors
    ),
  }, rendererIds);
};

const readProfile = (
  storage: TextRenderingStorage | false | undefined,
  rendererIds: ReadonlySet<TextRendererId>
) => {
  if (!storage) return DEFAULT_TEXT_RENDER_PROFILE;
  try {
    const stored = storage.getItem(TEXT_RENDER_PROFILE_STORAGE_KEY);
    if (stored) return decodeProfile(JSON.parse(stored), rendererIds);
    const legacyStored = storage.getItem(LEGACY_TEXT_RENDER_PROFILE_STORAGE_KEY);
    if (!legacyStored) return DEFAULT_TEXT_RENDER_PROFILE;
    const migrated = migrateLegacyProfile(JSON.parse(legacyStored), rendererIds);
    try {
      storage.setItem(TEXT_RENDER_PROFILE_STORAGE_KEY, JSON.stringify(migrated));
    } catch {
      // Migration remains usable in memory when browser storage is read-only.
    }
    return migrated;
  } catch {
    return DEFAULT_TEXT_RENDER_PROFILE;
  }
};

const toRenderedRows = (
  rows: ReturnType<typeof layoutCharDeskTextRunsToRows>["rows"],
  defaultColor: string
) => rows.map((row) => ({
  y: row.y,
  spans: row.spans.map((span) => ({
    x: span.x,
    width: span.width,
    text: span.text,
    color: span.color ?? defaultColor,
    ...(span.bgColor ? { bgColor: span.bgColor } : {}),
    ...(span.attrs ? { attrs: { ...span.attrs } } : {}),
    ...(span.href ? { href: span.href } : {}),
  })),
}));

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
    const layout = await this.#renderBlockLayout(source, defaultColor);
    if (!layout) return this.#render(source, defaultColor, false);
    return {
      kind: "styled",
      renderer: "block-layout",
      pipeline: ["block-layout"],
      cells: materializeCharDeskTextRows(layout.rows).map((cell) => ({
        x: cell.x,
        y: cell.y,
        char: cell.text,
        color: cell.color ?? defaultColor,
        ...(cell.bgColor ? { bgColor: cell.bgColor } : {}),
        ...(cell.attrs ? { attrs: { ...cell.attrs } } : {}),
        ...(cell.href ? { href: cell.href } : {}),
      })),
      diagnostics: layout.diagnostics,
    };
  };

  renderCompact = (
    source: string,
    defaultColor: string
  ): Promise<CompactTextRenderResult> => this.#renderBlockLayout(source, defaultColor)
    .then((layout) => layout ?? this.#render(source, defaultColor, true));

  async #renderBlockLayout(source: string, defaultColor: string) {
    // `---` is also a Markdown thematic break. In the automatic text pipeline,
    // only the layout-specific field separator is strong enough evidence that
    // the source is a block layout. Explicit CharGraph consumers can still
    // parse vertical-only layouts directly.
    if (!source.split(/\r?\n/u).some((line) => line.trim() === "|||")) {
      return null;
    }
    const parsed = parseBlockLayout(source);
    if (!parsed.document) return null;
    const columnGap = 4;
    const rowGap = 1;
    const rows = new Map<number, RenderedTextSpan[]>();
    const diagnostics: TextRenderResult["diagnostics"] = [...parsed.diagnostics];
    let originY = 0;
    let width = 0;
    let height = 0;
    for (const layoutRow of parsed.document.rows) {
      let originX = 0;
      let rowHeight = 1;
      for (const block of layoutRow) {
        const rendered = await this.#render(block.source, defaultColor, true);
        if (rendered.kind !== "spans") continue;
        rowHeight = Math.max(rowHeight, rendered.height);
        width = Math.max(width, originX + rendered.width);
        rendered.rows.forEach((row) => {
          const targetY = originY + row.y;
          const target = rows.get(targetY) ?? [];
          target.push(...row.spans.map((span) => ({
            ...span,
            x: originX + span.x,
          })));
          rows.set(targetY, target);
        });
        diagnostics.push(...rendered.diagnostics.map((diagnostic) => ({
          ...diagnostic,
          ...(diagnostic.offset !== undefined
            ? { offset: block.range.from + diagnostic.offset }
            : {}),
        })));
        originX += rendered.width + columnGap;
      }
      height = Math.max(height, originY + rowHeight);
      originY += rowHeight + rowGap;
    }
    return {
      kind: "spans" as const,
      renderer: "block-layout",
      pipeline: ["block-layout"],
      rows: Array.from(rows, ([y, spans]) => ({
        y,
        spans: spans.sort((left, right) => left.x - right.x),
      })).sort((left, right) => left.y - right.y),
      width,
      height,
      diagnostics,
    } satisfies CompactTextRenderResult;
  }

  #render(
    source: string,
    defaultColor: string,
    compact: false
  ): Promise<TextRenderResult>;
  #render(
    source: string,
    defaultColor: string,
    compact: true
  ): Promise<CompactTextRenderResult>;
  async #render(
    source: string,
    defaultColor: string,
    compact: boolean
  ): Promise<TextRenderResult | CompactTextRenderResult> {
    const profile = this.#profile;
    const context = {
      defaultColor,
      renderTheme: { ...DEFAULT_TEXT_RENDER_THEME, ...profile.renderTheme },
      features: profile.features,
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
            !plugin.fallback &&
            plugin.autoPriority !== undefined
          )
          .sort((left, right) => right.autoPriority! - left.autoPriority!)
      : [...this.#plugins.values()].filter(
          (plugin) => plugin.phase === "transform" && plugin.id === profile.mode
        );
    let transformedResult: TextTransformResult | null = null;
    for (const plugin of transformers) {
      if (plugin.phase !== "transform") continue;
      const transformed = await plugin.transform(input, context);
      if (!transformed?.recognized) continue;
      transformedResult = transformed;
      pipeline.push(plugin.id);
      break;
    }

    if (profile.mode === "auto" && pipeline.length === 0) {
      const fallback = [...this.#plugins.values()].find(
        (plugin) => plugin.phase === "transform" && plugin.fallback
      );
      if (fallback?.phase === "transform") {
        const transformed = await fallback.transform(input, context);
        if (transformed?.recognized) {
          transformedResult = transformed;
          pipeline.push(fallback.id);
        }
      }
    }

    if (transformedResult?.kind === "plain") {
      if (compact) {
        const parsed = layoutCharDeskTextRunsToRows(
          [{ text: transformedResult.text }],
          { defaultStyle: { color: defaultColor } }
        );
        return {
          kind: "spans",
          renderer: pipeline.at(-1)!,
          pipeline,
          rows: toRenderedRows(parsed.rows, defaultColor),
          width: parsed.width,
          height: parsed.height,
          diagnostics: [...input.diagnostics, ...transformedResult.diagnostics],
        };
      }
      return {
        kind: "plain",
        renderer: pipeline.at(-1)!,
        pipeline,
        text: transformedResult.text,
        diagnostics: [...input.diagnostics, ...transformedResult.diagnostics],
      };
    }

    if (pipeline.length === 0) {
      if (compact) {
        const parsed = layoutCharDeskTextRunsToRows(
          [{ text: source }],
          { defaultStyle: { color: defaultColor } }
        );
        return {
          kind: "spans",
          renderer: "raw",
          pipeline: ["raw"],
          rows: toRenderedRows(parsed.rows, defaultColor),
          width: parsed.width,
          height: parsed.height,
          diagnostics: [],
        };
      }
      return { kind: "plain", renderer: "raw", pipeline: ["raw"], text: source, diagnostics: [] };
    }

    const resolvedFragments: TextRenderFragment[] = transformedResult?.fragments ?? [{
      text: input.text,
      origin: { from: 0, to: input.text.length },
    }];
    const runs = composeTextFragments(input, resolvedFragments);
    const parsed = layoutCharDeskTextRunsToRows(runs, {
      defaultStyle: { color: defaultColor },
    });
    const diagnostics = [
      ...input.diagnostics,
      ...(transformedResult?.diagnostics ?? []),
      ...parsed.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    ];
    if (compact) {
      return {
        kind: "spans",
        renderer: pipeline.at(-1)!,
        pipeline,
        width: parsed.width,
        height: parsed.height,
        rows: toRenderedRows(parsed.rows, defaultColor),
        diagnostics,
      };
    }
    return {
      kind: "styled",
      renderer: pipeline.at(-1)!,
      pipeline,
      cells: materializeCharDeskTextRows(parsed.rows).map((cell) => ({
        x: cell.x,
        y: cell.y,
        char: cell.text,
        color: cell.color ?? defaultColor,
        ...(cell.bgColor ? { bgColor: cell.bgColor } : {}),
        ...(cell.attrs ? { attrs: { ...cell.attrs } } : {}),
        ...(cell.href ? { href: cell.href } : {}),
      })),
      diagnostics,
    };
  }
}

export const createTextRenderingRuntime = (
  options?: ConstructorParameters<typeof TextRenderingRuntime>[0]
) => new TextRenderingRuntime(options);

const defaultRuntime = createTextRenderingRuntime();

export const renderTextSource = (source: string, defaultColor: string) =>
  defaultRuntime.render(source, defaultColor);
