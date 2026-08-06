import type { ComponentType } from "react";
import type { EditorState } from "@/domains/canvas/public";
import type { ToolType } from "@/domains/canvas/public";

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
  | "toggle-sidebar"
  | "open-source-code";

// Unified Action ID
export type ActionId = EditorActionId | ToolbarActionId | SidebarActionId;

export type ShortcutToken =
  | "mod"
  | "shift"
  | "alt"
  | "delete"
  | "backspace"
  | "b"
  | "z"
  | "y"
  | "c"
  | "x"
  | "v"
  | "h";

export type ShortcutChord = readonly ShortcutToken[];

export interface ActionMeta {
  id: ActionId;
  label: string;
  shortcuts?: readonly ShortcutChord[];
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

export type ActionCompletion =
  | { succeeded: true; changed: boolean; reason?: string }
  | { succeeded: false; changed: false; reason: string };

export type ActionResult =
  | { handled: false; status: "unhandled"; reason?: string }
  | { handled: true; status: "rejected"; reason?: string }
  | { handled: true; status: "succeeded"; reason?: string }
  | { handled: true; status: "pending"; completion: Promise<ActionCompletion> };

// Action Context
export interface ActionContext {
  state: EditorState;
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
export type ActionChecker = (state: EditorState) => boolean;

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
