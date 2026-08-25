import {
  layoutCharDeskTextRunsToRows,
  materializeCharDeskTextRows,
} from "@chardesk/protocol";
import { renderCharGraphText } from "@chardesk/chargraph";
import {
  createDefaultFeatureSettings,
  createRegisteredMarkdownOptions,
  decodeFeatureSettings,
  migrateLegacyFeatureSettings,
} from "./features";
import type {
  CompactTextRenderResult,
  TextRenderProfile,
  TextRenderResult,
  TextRenderingStorage,
} from "./types";
import { DEFAULT_TEXT_RENDER_THEME } from "./theme";

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
  value: unknown
): TextRenderProfile => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_TEXT_RENDER_PROFILE;
  }
  const candidate = value as Partial<TextRenderProfile>;
  const candidateMode = typeof candidate.mode === "string" ? candidate.mode : "";
  const mode = ["auto", "raw", "ansi", "markdown"].includes(candidateMode)
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
  value: unknown
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
  });
};

const readProfile = (
  storage: TextRenderingStorage | false | undefined
) => {
  if (!storage) return DEFAULT_TEXT_RENDER_PROFILE;
  try {
    const stored = storage.getItem(TEXT_RENDER_PROFILE_STORAGE_KEY);
    if (stored) return decodeProfile(JSON.parse(stored));
    const legacyStored = storage.getItem(LEGACY_TEXT_RENDER_PROFILE_STORAGE_KEY);
    if (!legacyStored) return DEFAULT_TEXT_RENDER_PROFILE;
    const migrated = migrateLegacyProfile(JSON.parse(legacyStored));
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
  readonly #listeners = new Set<() => void>();
  readonly #storage?: TextRenderingStorage | false;
  #profile: TextRenderProfile;

  constructor(options: {
    storage?: TextRenderingStorage | false;
  } = {}) {
    this.#storage = options.storage;
    this.#profile = DEFAULT_TEXT_RENDER_PROFILE;
    this.#profile = readProfile(options.storage);
  }

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  getProfile = () => this.#profile;

  setProfile = (profile: TextRenderProfile) => {
    this.#profile = decodeProfile(profile);
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
    const rendered = await this.#render(source);
    if (rendered.renderer === "raw") {
      return {
        kind: "plain",
        renderer: "raw",
        pipeline: rendered.pipeline,
        text: source,
        diagnostics: rendered.diagnostics,
      };
    }
    const layout = layoutCharDeskTextRunsToRows(rendered.fragments, {
      defaultStyle: { color: defaultColor },
    });
    return {
      kind: "styled",
      renderer: rendered.renderer,
      pipeline: rendered.pipeline,
      cells: materializeCharDeskTextRows(layout.rows).map((cell) => ({
        x: cell.x,
        y: cell.y,
        char: cell.text,
        color: cell.color ?? defaultColor,
        ...(cell.bgColor ? { bgColor: cell.bgColor } : {}),
        ...(cell.attrs ? { attrs: { ...cell.attrs } } : {}),
        ...(cell.href ? { href: cell.href } : {}),
      })),
      diagnostics: [...rendered.diagnostics, ...layout.diagnostics],
    };
  };

  renderCompact = (
    source: string,
    defaultColor: string
  ): Promise<CompactTextRenderResult> => this.#render(source).then((rendered) => {
    const parsed = layoutCharDeskTextRunsToRows(rendered.fragments, {
      defaultStyle: { color: defaultColor },
    });
    return {
      kind: "spans",
      renderer: rendered.renderer,
      pipeline: rendered.pipeline,
      rows: toRenderedRows(parsed.rows, defaultColor),
      width: parsed.width,
      height: parsed.height,
      diagnostics: [...rendered.diagnostics, ...parsed.diagnostics],
    };
  });

  #render(source: string) {
    const profile = this.#profile;
    return renderCharGraphText(source, {
      mode: profile.mode,
      markdown: createRegisteredMarkdownOptions(
        profile.features,
        { ...DEFAULT_TEXT_RENDER_THEME, ...profile.renderTheme },
        profile.mode === "markdown"
      ),
    });
  }
}

export const createTextRenderingRuntime = (
  options?: ConstructorParameters<typeof TextRenderingRuntime>[0]
) => new TextRenderingRuntime(options);

const defaultRuntime = createTextRenderingRuntime();

export const renderTextSource = (source: string, defaultColor: string) =>
  defaultRuntime.render(source, defaultColor);
