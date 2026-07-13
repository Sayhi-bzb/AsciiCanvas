import type { Point } from "@/shared/types";
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
  getSelectionAnchor: () => Point | null;
  setSelectionAnchor: (point: Point | null) => void;
};

export const createCanvasInteractionRuntime = (): CanvasInteractionRuntime => {
  let state = INITIAL_INTERACTION_STATE;
  let selectionAnchor: Point | null = null;

  const dispatch = (event: InteractionEvent) => {
    state = transitionInteractionState(state, event);
    return state;
  };

  return {
    getState: () => state,
    dispatch,
    reset: () => dispatch({ type: "reset" }),
    getSelectionAnchor: () => selectionAnchor,
    setSelectionAnchor: (point) => {
      selectionAnchor = point ? { ...point } : null;
    },
  };
};
