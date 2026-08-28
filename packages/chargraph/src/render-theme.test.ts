import { describe, expect, it } from "vitest";
import {
  CHARDESK_LIGHT_RENDER_THEME,
  CHARDESK_RENDER_THEME_TOKENS,
  resolveCharDeskRenderTheme,
} from "./render-theme.js";

const contrastOnWhite = (hex: string) => {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  };
  const rgb = [1, 3, 5].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16)
  );
  const luminance = 0.2126 * linear(rgb[0]!)
    + 0.7152 * linear(rgb[1]!)
    + 0.0722 * linear(rgb[2]!);
  return 1.05 / (luminance + 0.05);
};

describe("CharDesk render theme", () => {
  it("publishes the Canvas-adapted Primer light palette", () => {
    expect(CHARDESK_LIGHT_RENDER_THEME).toEqual({
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
    expect(Object.keys(CHARDESK_LIGHT_RENDER_THEME))
      .toEqual([...CHARDESK_RENDER_THEME_TOKENS]);
  });

  it("migrates legacy muted input without overriding explicit split roles", () => {
    expect(resolveCharDeskRenderTheme({
      muted: "#777777",
      "grid-subtle": "#888888",
    })).toMatchObject({
      "muted-foreground": "#777777",
      "border-subtle": "#777777",
      "grid-subtle": "#888888",
    });
  });

  it("keeps semantic text readable and structural strokes stronger than grids", () => {
    const textTokens = [
      "foreground",
      "accent",
      "info",
      "done",
      "success",
      "warning",
      "danger",
      "muted-foreground",
    ] as const;

    expect(textTokens.every((token) =>
      contrastOnWhite(CHARDESK_LIGHT_RENDER_THEME[token]) >= 4.5
    )).toBe(true);
    expect(contrastOnWhite(CHARDESK_LIGHT_RENDER_THEME["border-subtle"]))
      .toBeGreaterThan(
        contrastOnWhite(CHARDESK_LIGHT_RENDER_THEME["grid-subtle"])
      );
  });
});
