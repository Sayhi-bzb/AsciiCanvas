import type { Point } from "@/shared/types";
import {
  EditorRootStateNode,
  EditorStateNode,
  editorRuntime,
} from "@/domains/editor/public";
import type { CanvasState } from "@/domains/canvas/public";
import {
  INITIAL_INTERACTION_STATE,
  transitionInteractionState,
  type InteractionEvent,
  type InteractionState,
} from "./interactionMachine";

export type CanvasInteractionRuntime = {
  getState: () => InteractionState;
  dispatch: (event: InteractionEvent) => InteractionState;
  reset: () => InteractionState;
  getStatePath: () => string;
  getSelectionAnchor: () => Point | null;
  setSelectionAnchor: (point: Point | null) => void;
};

class CanvasInteractionStateNode extends EditorStateNode<
  CanvasState,
  InteractionEvent
> {
  #state: InteractionState | null = null;

  constructor(
    id: InteractionState["type"],
    parent: EditorRootStateNode<CanvasState, InteractionEvent>
  ) {
    super(editorRuntime, id, parent);
  }

  setState(state: InteractionState) {
    this.#state = state;
  }

  getState() {
    return this.#state;
  }

}

const INTERACTION_STATE_IDS: readonly InteractionState["type"][] = [
  "idle",
  "panning",
  "selecting",
  "drawing",
  "shapePreview",
  "structuredMoving",
  "structuredRectResizing",
  "structuredSplitBoxResizing",
  "structuredSplitBoxResizePending",
  "structuredLineResizing",
  "structuredTextSelecting",
];

export const createCanvasInteractionRuntime = (): CanvasInteractionRuntime => {
  let state = INITIAL_INTERACTION_STATE;
  let selectionAnchor: Point | null = null;
  const root = new EditorRootStateNode<CanvasState, InteractionEvent>(editorRuntime);
  for (const id of INTERACTION_STATE_IDS) {
    root.addChild(new CanvasInteractionStateNode(id, root));
  }
  root.enter();
  root.transition("idle", state);

  const dispatch = (event: InteractionEvent) => {
    const next = transitionInteractionState(state, event);
    const active = root.getCurrent() as CanvasInteractionStateNode;
    if (active.id === next.type) active.setState(next);
    else {
      root.transition(next.type, next);
      (root.getCurrent() as CanvasInteractionStateNode).setState(next);
    }
    state = next;
    return state;
  };

  return {
    getState: () =>
      (root.getCurrent() as CanvasInteractionStateNode).getState() ?? state,
    dispatch,
    reset: () => dispatch({ type: "reset" }),
    getStatePath: () => root.getCurrent()?.getPath() ?? root.getPath(),
    getSelectionAnchor: () => selectionAnchor,
    setSelectionAnchor: (point) => {
      selectionAnchor = point ? { ...point } : null;
    },
  };
};
