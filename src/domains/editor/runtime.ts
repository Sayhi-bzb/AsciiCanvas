import {
  canvasCommands,
  getCanvasState,
  subscribeCanvasState,
  type CanvasState,
  type ToolType,
} from "@/domains/canvas/public";
import { EditorRuntime } from "./core/runtime";
import { EditorStateNode } from "./core/stateNode";
import type { EditorExtension, EditorInputEvent } from "./core/types";

const BUILT_IN_TOOLS: readonly ToolType[] = [
  "select",
  "pan",
  "text",
  "brush",
  "eraser",
  "fill",
  "box",
  "splitBox",
  "line",
  "arrowLine",
  "bg",
  "stepline",
  "circle",
];

class CanvasToolStateNode extends EditorStateNode<CanvasState, EditorInputEvent> {}

export const createCanvasEditorExtension = (): EditorExtension<CanvasState> => ({
  id: "chardesk.canvas",
  stateScopes: [
    { key: "canvas.content", scope: "document" },
    { key: "canvas.interaction", scope: "session" },
    { key: "canvas.viewport", scope: "session" },
    { key: "canvas.preferences", scope: "session" },
    { key: "canvas.projection", scope: "derived" },
  ],
  tools: BUILT_IN_TOOLS.map((id) => ({
    id,
    create: (editor, parent) => new CanvasToolStateNode(editor, id, parent),
  })),
});

export const editorRuntime = new EditorRuntime<CanvasState>({
  state: {
    get: getCanvasState,
    subscribe: subscribeCanvasState,
  },
  history: {
    undo: canvasCommands.history.undo,
    redo: canvasCommands.history.redo,
    beginCheckpoint: canvasCommands.history.beginCheckpoint,
    finishCapture: canvasCommands.history.finishCapture,
  },
  transactions: {
    run: canvasCommands.history.transact,
  },
  onToolChange: (id) => canvasCommands.tools.set(id as ToolType),
});
