export const CHARDESK_RENDER_THEME_TOKENS = [
  "foreground",
  "background",
  "accent",
  "accent-foreground",
  "info",
  "success",
  "warning",
  "danger",
  "muted",
  "surface",
  "surface-foreground",
] as const;

export type CharDeskRenderThemeToken =
  typeof CHARDESK_RENDER_THEME_TOKENS[number];

export type CharDeskRenderTheme = Record<CharDeskRenderThemeToken, string>;

export type CharDeskRenderColorDefault =
  | { readonly kind: "inherit" }
  | { readonly kind: "token"; readonly token: CharDeskRenderThemeToken }
  | {
      readonly kind: "mixed";
      readonly tokens: readonly CharDeskRenderThemeToken[];
      readonly includesInherited?: boolean;
    };

export const CHARDESK_LIGHT_RENDER_THEME: CharDeskRenderTheme = Object.freeze({
  foreground: "#000000",
  background: "#ffffff",
  accent: "#2563eb",
  "accent-foreground": "#ffffff",
  info: "#0891b2",
  success: "#16a34a",
  warning: "#ca8a04",
  danger: "#dc2626",
  muted: "#94a3b8",
  surface: "#e2e8f0",
  "surface-foreground": "#000000",
});

export const resolveCharDeskRenderColor = (
  value: CharDeskRenderColorDefault,
  theme: CharDeskRenderTheme
) => value.kind === "token" ? theme[value.token] : undefined;
