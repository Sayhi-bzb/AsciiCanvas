import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { CanvasEngineRuntime } from "./CanvasEngineRuntime";

const CanvasEngineContext = createContext<CanvasEngineRuntime | null>(null);

export const CanvasEngineProvider = ({ children }: { children: ReactNode }) => {
  const [runtime] = useState(() => new CanvasEngineRuntime());
  useEffect(() => runtime.acquire(), [runtime]);
  return createElement(CanvasEngineContext.Provider, { value: runtime }, children);
};

export const useCanvasEngineRuntime = (): CanvasEngineRuntime => {
  const provided = useContext(CanvasEngineContext);
  const [fallback] = useState(() => provided ?? new CanvasEngineRuntime());
  useEffect(() => {
    if (provided) return;
    return fallback.acquire();
  }, [fallback, provided]);
  return provided ?? fallback;
};
