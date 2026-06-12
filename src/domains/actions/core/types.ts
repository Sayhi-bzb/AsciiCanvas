import type { ComponentType } from "react";
import type { CanvasState } from "@/domains/canvas/state/interfaces";
import type { ToolType } from "@/shared/types";

// Editor Actions
export type EditorActionId =
  | "undo"
  | "redo"
  | "copy"
  | "copy-rich"
  | "copy-ansi"
  | "cut"
  | "paste"
  | "fill-selection-char"
  | "snapshot-png"
  | "delete-selection";

// Toolbar Actions
export type ToolbarActionId =
  | "select"
  | "brush"
  | "shape-group"
  | "fill"
  | "eraser"
  | "undo"
  | "color";

// Sidebar Actions
export type SidebarActionId =
  | "toggle-grid"
  | "reset-view"
  | "open-source-code";

// Unified Action ID
export type ActionId = EditorActionId | ToolbarActionId | SidebarActionId;

export interface ActionMeta {
  id: ActionId;
  label: string;
  shortcut?: string;
  icon?: ComponentType<{ className?: string }>;
  hasSub?: boolean;
  destructive?: boolean;
}

// Action Source
export type ActionSource =
  | "keyboard"
  | "toolbar"
  | "context-menu"
  | "sidebar"
  | "canvas-keydown"
  | "global-hotkey"
  | "clipboard-event";

// Action Result
export interface ActionResult {
  handled: boolean;
  succeeded: boolean;
  reason?: string;
}

// Action Context
export interface ActionContext {
  state: CanvasState;
  setTool: (tool: ToolType) => void;
  onUndo: () => void;
  onRedo: () => void;
}

// Action Handler
export type ActionHandler<T = unknown> = (
  options: T,
  context: ActionContext
) => ActionResult;

// Action Checker
export type ActionChecker = (state: CanvasState) => boolean;

// Context Menu Entry
export type ContextMenuEntry =
  | { type: "action"; id: EditorActionId }
  | { type: "separator" };
