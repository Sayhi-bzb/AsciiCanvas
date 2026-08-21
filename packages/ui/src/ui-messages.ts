import * as React from "react";

export type UiMessages = {
  dialogClose: string;
  notificationRegion: string;
  sidebarTitle: string;
  sidebarMobileDescription: string;
  sidebarToggle: string;
};

export const defaultUiMessages: UiMessages = {
  dialogClose: "Close",
  notificationRegion: "Notifications",
  sidebarTitle: "Sidebar",
  sidebarMobileDescription: "Displays the mobile sidebar.",
  sidebarToggle: "Toggle Sidebar",
};

export const UiMessagesContext =
  React.createContext<UiMessages>(defaultUiMessages);

export function useUiMessages() {
  return React.useContext(UiMessagesContext);
}
