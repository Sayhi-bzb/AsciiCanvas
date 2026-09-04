"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import type { UiThemeMode } from "./ui-theme.js";
import {
  UiMessagesContext,
  defaultUiMessages,
  type UiMessages,
} from "./ui-messages.js";

export type UiProviderProps = {
  children: React.ReactNode;
  messages?: Partial<UiMessages>;
  defaultTheme?: UiThemeMode;
};

export function UiProvider({
  children,
  messages,
  defaultTheme = "light",
}: UiProviderProps) {
  const value = React.useMemo(
    () => ({ ...defaultUiMessages, ...messages }),
    [messages]
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem
      storageKey="chardesk-host-theme"
      disableTransitionOnChange
    >
      <UiMessagesContext.Provider value={value}>
        {children}
      </UiMessagesContext.Provider>
    </ThemeProvider>
  );
}
