import {
  BringToFront,
  Clipboard,
  Copy,
  CopyPlus,
  Eraser,
  Hand,
  Image,
  LineSquiggle,
  MousePointer2,
  PaintBucket,
  Palette,
  Pencil,
  Scissors,
  SendToBack,
  SquarePen,
  Trash2,
  Undo2,
} from "lucide-react";
import type { ActionMeta, ContextMenuEntry, EditorActionId, ToolbarActionId, SidebarActionId } from "./types";

// Editor Actions
export const EDITOR_ACTION_META: Record<EditorActionId, ActionMeta> = {
  undo: { id: "undo", label: "Undo", shortcut: "⌘Z" },
  redo: { id: "redo", label: "Redo", shortcut: "⌘⇧Z / ⌘Y" },
  copy: { id: "copy", label: "Copy as Text", shortcut: "⌘C", icon: Copy },
  "copy-rich": {
    id: "copy-rich",
    label: "Copy with Color",
    icon: Palette,
  },
  "copy-ansi": {
    id: "copy-ansi",
    label: "Copy as ANSI",
    icon: Palette,
  },
  cut: { id: "cut", label: "Cut Zone", shortcut: "⌘X", icon: Scissors },
  paste: { id: "paste", label: "Paste Lot", shortcut: "⌘V", icon: Clipboard },
  "fill-selection-char": { id: "fill-selection-char", label: "Fill Selection" },
  "snapshot-png": {
    id: "snapshot-png",
    label: "Snapshot (PNG)",
    icon: Image,
  },
  "delete-selection": {
    id: "delete-selection",
    label: "Demolish (Delete)",
    shortcut: "⌫",
    icon: Trash2,
    destructive: true,
  },
  "structured-rename": {
    id: "structured-rename",
    label: "Rename",
    icon: SquarePen,
  },
  "structured-bring-forward": {
    id: "structured-bring-forward",
    label: "Bring Forward",
    icon: BringToFront,
  },
  "structured-send-backward": {
    id: "structured-send-backward",
    label: "Send Backward",
    icon: SendToBack,
  },
  "structured-bring-to-front": {
    id: "structured-bring-to-front",
    label: "Bring to Front",
    icon: BringToFront,
  },
  "structured-send-to-back": {
    id: "structured-send-to-back",
    label: "Send to Back",
    icon: SendToBack,
  },
  "structured-duplicate": {
    id: "structured-duplicate",
    label: "Duplicate",
    icon: CopyPlus,
  },
};

// Toolbar Actions
export const TOOLBAR_ACTION_ORDER: ToolbarActionId[] = [
  "select",
  "brush",
  "shape-group",
  "fill",
  "eraser",
  "undo",
  "color",
];

export const TOOLBAR_ACTION_META: Record<ToolbarActionId, ActionMeta> = {
  select: { id: "select", label: "Select", icon: MousePointer2 },
  brush: { id: "brush", label: "Brush", icon: Pencil, hasSub: true },
  "shape-group": {
    id: "shape-group",
    label: "Shape",
    icon: LineSquiggle,
    hasSub: true,
  },
  fill: { id: "fill", label: "Fill Area", icon: PaintBucket },
  eraser: { id: "eraser", label: "Eraser", icon: Eraser },
  undo: { id: "undo", label: "Undo", icon: Undo2 },
  color: { id: "color", label: "Color", icon: Palette, hasSub: true },
  pan: { id: "pan", label: "Pan", icon: Hand },
};

// Sidebar Actions
export const SIDEBAR_ACTION_META: Record<SidebarActionId, ActionMeta> = {
  "toggle-grid": { id: "toggle-grid", label: "Toggle Grid" },
  "reset-view": { id: "reset-view", label: "Reset View" },
  "open-source-code": { id: "open-source-code", label: "Open Source Code" },
};

// Unified Action Catalog
export const ACTION_CATALOG: Record<string, ActionMeta> = {
  ...EDITOR_ACTION_META,
  ...TOOLBAR_ACTION_META,
  ...SIDEBAR_ACTION_META,
};

// Context Menu Configuration
export const CANVAS_CONTEXT_MENU: ContextMenuEntry[] = [
  { type: "action", id: "copy" },
  { type: "action", id: "copy-rich" },
  { type: "action", id: "copy-ansi" },
  { type: "action", id: "snapshot-png" },
  { type: "action", id: "cut" },
  { type: "action", id: "paste" },
  { type: "separator" },
  { type: "action", id: "delete-selection" },
];


export const STRUCTURED_CONTEXT_MENU: ContextMenuEntry[] = [
  { type: "action", id: "structured-rename" },
  { type: "separator" },
  { type: "action", id: "structured-bring-forward" },
  { type: "action", id: "structured-send-backward" },
  { type: "action", id: "structured-bring-to-front" },
  { type: "action", id: "structured-send-to-back" },
  { type: "separator" },
  { type: "action", id: "structured-duplicate" },
  { type: "separator" },
  { type: "action", id: "delete-selection" },
];
