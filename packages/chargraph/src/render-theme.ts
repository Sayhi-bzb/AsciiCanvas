export const CHARDESK_RENDER_THEME_TOKENS = [
  "foreground",
  "background",
  "accent",
  "accent-foreground",
  "info",
  "done",
  "success",
  "warning",
  "danger",
  "muted-foreground",
  "border-subtle",
  "grid-subtle",
  "surface",
  "surface-foreground",
] as const;

export type CharDeskRenderThemeToken =
  typeof CHARDESK_RENDER_THEME_TOKENS[number];

export type CharDeskRenderTheme = Record<CharDeskRenderThemeToken, string>;

/** Theme input accepted from current callers and profiles saved before muted split. */
export type CharDeskRenderThemeInput = Partial<CharDeskRenderTheme> & {
  readonly muted?: string;
};

export type CharDeskRenderColorDefault =
  | { readonly kind: "inherit" }
  | { readonly kind: "token"; readonly token: CharDeskRenderThemeToken }
  | {
      readonly kind: "mixed";
      readonly tokens: readonly CharDeskRenderThemeToken[];
      readonly includesInherited?: boolean;
    };

export const CHARDESK_LIGHT_RENDER_THEME: CharDeskRenderTheme = Object.freeze({
  foreground: "#1f2328",
  background: "#ffffff",
  accent: "#0969da",
  "accent-foreground": "#ffffff",
  info: "#0969da",
  done: "#8250df",
  success: "#1a7f37",
  warning: "#9a6700",
  danger: "#d1242f",
  "muted-foreground": "#59636e",
  "border-subtle": "#818b98",
  "grid-subtle": "#d1d9e0",
  surface: "#f6f8fa",
  "surface-foreground": "#1f2328",
});

const MUTED_THEME_TOKENS = new Set<CharDeskRenderThemeToken>([
  "muted-foreground",
  "border-subtle",
  "grid-subtle",
]);

export const resolveCharDeskRenderTheme = (
  input: CharDeskRenderThemeInput = {}
): CharDeskRenderTheme => Object.freeze(Object.fromEntries(
  CHARDESK_RENDER_THEME_TOKENS.map((token) => [
    token,
    input[token]
      ?? (MUTED_THEME_TOKENS.has(token) ? input.muted : undefined)
      ?? CHARDESK_LIGHT_RENDER_THEME[token],
  ])
) as unknown as CharDeskRenderTheme);

export const resolveCharDeskRenderColor = (
  value: CharDeskRenderColorDefault,
  theme: CharDeskRenderTheme
) => value.kind === "token" ? theme[value.token] : undefined;
