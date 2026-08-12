import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { CanvasEngineRuntime } from "./CanvasEngineRuntime";
import { useCanvasRuntime } from "@/domains/canvas/public";

const CanvasEngineContext = createContext<CanvasEngineRuntime | null>(null);
let canvasEngineRuntimeFallback: CanvasEngineRuntime | null = null;

export const configureCanvasEngineRuntimeFallbackForTesting = (
  runtime: CanvasEngineRuntime | null
) => {
  canvasEngineRuntimeFallback = runtime;
};

export const CanvasEngineProvider = ({ children }: { children: ReactNode }) => {
  const canvas = useCanvasRuntime();
  const [runtime] = useState(() => new CanvasEngineRuntime({
    getViewport: () => {
      const state = canvas.getState();
      return { offset: state.offset, zoom: state.zoom };
    },
    setViewport: canvas.commands.viewport.setViewport,
  }));
  useEffect(() => runtime.acquire(), [runtime]);
  return createElement(CanvasEngineContext.Provider, { value: runtime }, children);
};

export const useCanvasEngineRuntime = (): CanvasEngineRuntime => {
  const provided = useContext(CanvasEngineContext) ?? canvasEngineRuntimeFallback;
  if (!provided) {
    throw new Error("useCanvasEngineRuntime must be used within CanvasEngineProvider");
  }
  return provided;
};
