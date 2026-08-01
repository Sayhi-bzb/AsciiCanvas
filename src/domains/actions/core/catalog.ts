import { HOST_ICONOLOGY } from "@/shared/icons/iconology";
import type {
  ActionMeta,
  ContextMenuEntry,
  EditorActionId,
  SidebarActionId,
  ToolbarActionId,
} from "./types";

// Editor Actions
const EDITOR_ACTION_META: Record<EditorActionId, ActionMeta> = {
  undo: { id: "undo", label: "Undo", shortcuts: [["mod", "z"]] },
  redo: {
    id: "redo",
    label: "Redo",
    shortcuts: [["mod", "shift", "z"], ["mod", "y"]],
  },
  copy: {
    id: "copy",
    label: "Copy as Text",
    icon: HOST_ICONOLOGY.editorAction.copy,
    shortcuts: [["mod", "c"]],
  },
  "copy-rich": {
    id: "copy-rich",
    label: "Copy with Color",
    icon: HOST_ICONOLOGY.editorAction["copy-rich"],
  },
  "copy-ansi": {
    id: "copy-ansi",
    label: "Copy as ANSI",
    icon: HOST_ICONOLOGY.editorAction["copy-ansi"],
  },
  cut: {
    id: "cut",
    label: "Cut Zone",
    icon: HOST_ICONOLOGY.editorAction.cut,
    shortcuts: [["mod", "x"]],
  },
  paste: {
    id: "paste",
    label: "Paste Lot",
    icon: HOST_ICONOLOGY.editorAction.paste,
    shortcuts: [["mod", "v"]],
  },
  "fill-selection-char": { id: "fill-selection-char", label: "Fill Selection" },
  "snapshot-png": {
    id: "snapshot-png",
    label: "Snapshot (PNG)",
    icon: HOST_ICONOLOGY.editorAction["snapshot-png"],
  },
  "delete-selection": {
    id: "delete-selection",
    label: "Delete",
    icon: HOST_ICONOLOGY.editorAction["delete-selection"],
    destructive: true,
    shortcuts: [["backspace"], ["delete"]],
  },
  "structured-rename": {
    id: "structured-rename",
    label: "Rename",
    icon: HOST_ICONOLOGY.editorAction["structured-rename"],
  },
  "structured-bring-forward": {
    id: "structured-bring-forward",
    label: "Bring Forward",
    icon: HOST_ICONOLOGY.editorAction["structured-bring-forward"],
  },
  "structured-send-backward": {
    id: "structured-send-backward",
    label: "Send Backward",
    icon: HOST_ICONOLOGY.editorAction["structured-send-backward"],
  },
  "structured-bring-to-front": {
    id: "structured-bring-to-front",
    label: "Bring to Front",
    icon: HOST_ICONOLOGY.editorAction["structured-bring-to-front"],
  },
  "structured-send-to-back": {
    id: "structured-send-to-back",
    label: "Send to Back",
    icon: HOST_ICONOLOGY.editorAction["structured-send-to-back"],
  },
  "structured-duplicate": {
    id: "structured-duplicate",
    label: "Duplicate",
    icon: HOST_ICONOLOGY.editorAction["structured-duplicate"],
  },
  "structured-copy-hierarchy": {
    id: "structured-copy-hierarchy",
    label: "Copy Structure",
    icon: HOST_ICONOLOGY.editorAction["structured-copy-hierarchy"],
  },
  "structured-split-horizontal": {
    id: "structured-split-horizontal",
    label: "Split Horizontal",
    icon: HOST_ICONOLOGY.editorAction["structured-split-horizontal"],
  },
  "structured-split-vertical": {
    id: "structured-split-vertical",
    label: "Split Vertical",
    icon: HOST_ICONOLOGY.editorAction["structured-split-vertical"],
  },
  "structured-delete-divider": {
    id: "structured-delete-divider",
    label: "Delete Divider",
    icon: HOST_ICONOLOGY.editorAction["structured-delete-divider"],
    destructive: true,
  },
};

// Toolbar Actions
export const TOOLBAR_ACTION_ORDER: ToolbarActionId[] = [
  "select",
  "brush",
  "shape-group",
  "fill",
  "eraser",
  "color",
];

export const TOOLBAR_ACTION_META: Record<ToolbarActionId, ActionMeta> = {
  select: {
    id: "select",
    label: "Select",
    icon: HOST_ICONOLOGY.toolbarAction.select,
  },
  text: {
    id: "text",
    label: "Text",
    icon: HOST_ICONOLOGY.toolbarAction.text,
  },
  brush: {
    id: "brush",
    label: "Brush",
    icon: HOST_ICONOLOGY.toolbarAction.brush,
    hasSub: true,
  },
  "shape-group": {
    id: "shape-group",
    label: "Shape",
    icon: HOST_ICONOLOGY.toolbarAction["shape-group"],
    hasSub: true,
  },
  bg: {
    id: "bg",
    label: "Background",
    icon: HOST_ICONOLOGY.toolbarAction.bg,
  },
  fill: {
    id: "fill",
    label: "Paint Char Color",
    icon: HOST_ICONOLOGY.toolbarAction.fill,
  },
  eraser: {
    id: "eraser",
    label: "Eraser",
    icon: HOST_ICONOLOGY.toolbarAction.eraser,
  },
  undo: {
    ...EDITOR_ACTION_META.undo,
    icon: HOST_ICONOLOGY.toolbarAction.undo,
  },
  color: {
    id: "color",
    label: "Color",
    icon: HOST_ICONOLOGY.toolbarAction.color,
    hasSub: true,
  },
  pan: {
    id: "pan",
    label: "Hand",
    icon: HOST_ICONOLOGY.toolbarAction.pan,
  },
};

// Sidebar Actions
const SIDEBAR_ACTION_META: Record<SidebarActionId, ActionMeta> = {
  "toggle-grid": { id: "toggle-grid", label: "Toggle Grid" },
  "toggle-sidebar": {
    id: "toggle-sidebar",
    label: "Toggle Sidebar",
    shortcuts: [["mod", "b"]],
  },
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
  { type: "action", id: "copy-ansi" },
  { type: "action", id: "snapshot-png" },
  { type: "action", id: "paste" },
  { type: "separator" },
  { type: "action", id: "delete-selection" },
];

export const STRUCTURED_CONTEXT_MENU: ContextMenuEntry[] = [
  { type: "action", id: "structured-rename" },
  {
    type: "submenu",
    label: "Layer",
    icon: HOST_ICONOLOGY.editorAction["structured-layer-menu"],
    children: [
      { type: "action", id: "structured-bring-forward" },
      { type: "action", id: "structured-send-backward" },
      { type: "action", id: "structured-bring-to-front" },
      { type: "action", id: "structured-send-to-back" },
    ],
  },
  { type: "separator" },
  { type: "action", id: "structured-duplicate" },
  { type: "action", id: "structured-copy-hierarchy" },
  { type: "separator" },
  { type: "action", id: "delete-selection" },
];
