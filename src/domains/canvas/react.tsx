/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { useStore } from "zustand";
import type { EditorState } from "./state/interfaces";
import type { CanvasRuntime } from "./runtime";

type CanvasRuntimeContextValue = Pick<
  CanvasRuntime,
  | "store"
  | "documents"
  | "commands"
  | "queries"
  | "getState"
  | "subscribe"
  | "dispose"
  | "ready"
  | "getPersistenceSnapshot"
  | "subscribePersistence"
  | "retryPersistence"
  | "setRetainedCanvasIds"
  | "getProjectionCacheStats"
  | "setProjectionCacheBudget"
  | "subscribeProjectionCache"
>;

const CanvasRuntimeContext = createContext<CanvasRuntimeContextValue | null>(null);
let canvasRuntimeFallback: CanvasRuntimeContextValue | null = null;

export const configureCanvasRuntimeFallbackForTesting = (
  runtime: CanvasRuntimeContextValue | null
) => {
  canvasRuntimeFallback = runtime;
};

export const CanvasRuntimeProvider = ({
  runtime,
  children,
}: {
  runtime: CanvasRuntimeContextValue;
  children: ReactNode;
}) => (
  <CanvasRuntimeContext.Provider value={runtime}>
    {children}
  </CanvasRuntimeContext.Provider>
);

export const useCanvasRuntime = () => {
  const runtime = useContext(CanvasRuntimeContext) ?? canvasRuntimeFallback;
  if (!runtime) {
    throw new Error("useCanvasRuntime must be used within CanvasRuntimeProvider");
  }
  return runtime;
};

export const useCanvasState = <Selected,>(
  selector: (state: EditorState) => Selected
) => useStore(useCanvasRuntime().store, selector);

export const useCanvasPersistence = () => {
  const runtime = useCanvasRuntime();
  return useSyncExternalStore(
    runtime.subscribePersistence,
    runtime.getPersistenceSnapshot,
    runtime.getPersistenceSnapshot
  );
};
