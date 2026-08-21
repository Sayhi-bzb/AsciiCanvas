import * as React from "react";
import {
  UiMessagesContext,
  defaultUiMessages,
  type UiMessages,
} from "./ui-messages.js";

export function UiProvider({
  children,
  messages,
}: {
  children: React.ReactNode;
  messages?: Partial<UiMessages>;
}) {
  const value = React.useMemo(
    () => ({ ...defaultUiMessages, ...messages }),
    [messages]
  );

  return (
    <UiMessagesContext.Provider value={value}>
      {children}
    </UiMessagesContext.Provider>
  );
}
