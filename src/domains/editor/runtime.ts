import {
  type CanvasState,
  type ToolType,
} from "@/domains/canvas/public";
import { EditorRuntime } from "./core/runtime";
import type {
  EditorExtension,
  EditorHistoryPort,
  EditorStateAdapter,
  EditorTransactionPort,
} from "./core/types";
import {
  CanvasInteractionPortBinding,
  CanvasToolStateNode,
  type CanvasEditorInputEvent,
  type CanvasInteractionState,
} from "./canvasToolRuntime";

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

export const createCanvasEditorExtension = (
  interactionPort: CanvasInteractionPortBinding
): EditorExtension<
  CanvasState,
  CanvasEditorInputEvent
> => ({
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
    create: (editor, parent) =>
      new CanvasToolStateNode(editor, id, parent, interactionPort),
  })),
});

export class CanvasEditorRuntime extends EditorRuntime<
  CanvasState,
  CanvasEditorInputEvent
> {
  readonly interactionPort = new CanvasInteractionPortBinding();

  getInteractionState = (): CanvasInteractionState => {
    const current = this.root.getCurrent();
    return current instanceof CanvasToolStateNode
      ? current.getInteractionState()
      : { type: "idle" };
  };
}

export type CanvasEditorRuntimePorts = {
  state: EditorStateAdapter<CanvasState>;
  history: EditorHistoryPort;
  transactions: EditorTransactionPort;
  onToolChange?: (id: ToolType) => void;
};

export const createCanvasEditorRuntime = (ports: CanvasEditorRuntimePorts) =>
  new CanvasEditorRuntime({
    state: ports.state,
    history: ports.history,
    transactions: ports.transactions,
    onToolChange: (id) => ports.onToolChange?.(id as ToolType),
  });
