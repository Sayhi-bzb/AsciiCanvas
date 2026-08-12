/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { CanvasState } from "@/domains/canvas/public";
import { EditorRuntime } from "./core/runtime";
import { editorRuntime } from "./runtime";

const EditorContext = createContext<EditorRuntime<CanvasState>>(editorRuntime);

export const EditorProvider = ({
  editor = editorRuntime,
  children,
}: {
  editor?: EditorRuntime<CanvasState>;
  children: ReactNode;
}) => <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>;

export const useEditor = () => useContext(EditorContext);

export const useEditorValue = <Selected,>(
  selector: (state: Readonly<CanvasState>) => Selected,
  isEqual: (left: Selected, right: Selected) => boolean = Object.is
) => {
  const editor = useEditor();
  const cache = useRef<{ state: Readonly<CanvasState>; value: Selected } | null>(null);
  const getSnapshot = useCallback(() => {
    const state = editor.getState();
    const previous = cache.current;
    if (previous?.state === state) return previous.value;
    const value = selector(state);
    if (previous && isEqual(previous.value, value)) {
      cache.current = { state, value: previous.value };
      return previous.value;
    }
    cache.current = { state, value };
    return value;
  }, [editor, isEqual, selector]);

  return useSyncExternalStore(editor.subscribe, getSnapshot, getSnapshot);
};
