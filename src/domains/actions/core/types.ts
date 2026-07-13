import type { ComponentType } from "react";
import type { CanvasState } from "@/domains/canvas/public";
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
  | "delete-selection"
  | "structured-rename"
  | "structured-bring-forward"
  | "structured-send-backward"
  | "structured-bring-to-front"
  | "structured-send-to-back"
  | "structured-duplicate"
  | "structured-copy-hierarchy"
  | "structured-split-horizontal"
  | "structured-split-vertical"
  | "structured-delete-divider";

// Toolbar Actions
export type ToolbarActionId =
  | "select"
  | "pan"
  | "text"
  | "brush"
  | "shape-group"
  | "bg"
  | "fill"
  | "eraser"
  | "undo"
  | "color";

// Sidebar Actions
export type SidebarActionId =
  | "toggle-grid"
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
  | { type: "separator" }
  | {
      type: "submenu";
      label: string;
      icon?: ComponentType<{ className?: string }>;
      children: ContextMenuEntry[];
    };
