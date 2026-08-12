import { useEditorStore } from "./editorStore";
import type { CanvasState } from "./interfaces";

export const useCanvasState = <Selected>(
  selector: (state: CanvasState) => Selected
) => useEditorStore(selector);

export const getCanvasState = (): CanvasState => useEditorStore.getState();

export const subscribeCanvasState = (
  listener: (state: CanvasState, previous: CanvasState) => void
) => useEditorStore.subscribe(listener);
