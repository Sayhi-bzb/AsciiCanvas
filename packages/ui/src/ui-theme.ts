"use client";

import { useTheme } from "next-themes";

export type UiThemeMode = "light" | "dark" | "system";

export function useUiTheme() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return {
    theme: theme as UiThemeMode | undefined,
    resolvedTheme: resolvedTheme as Exclude<UiThemeMode, "system"> | undefined,
    setTheme: (mode: UiThemeMode) => setTheme(mode),
  };
}
