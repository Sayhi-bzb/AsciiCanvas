import { browser } from "@/shared/services/effects";
import { APP_SOURCE_URL } from "@/shared/lib/constants";
import {
  actionSucceeded,
} from "../result";
import type {
  ActionHandler,
  ActionResult,
  SidebarActionId,
} from "../types";

// Sidebar action options
type SidebarOptions = {
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  setZoom: (updater: (prev: number) => number) => void;
  setOffset: (updater: (prev: { x: number; y: number }) => { x: number; y: number }) => void;
  sourceCodeUrl?: string;
};

// Sidebar action handlers
export const sidebarHandlers: Record<
  SidebarActionId,
  ActionHandler<SidebarOptions>
> = {
  "toggle-grid": (options): ActionResult => {
    options.setShowGrid(!options.showGrid);
    return actionSucceeded();
  },

  "open-source-code": (options): ActionResult => {
    browser.openExternal(options.sourceCodeUrl ?? APP_SOURCE_URL);
    return actionSucceeded();
  },
};
