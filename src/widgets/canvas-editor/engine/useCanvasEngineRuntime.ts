import { useEffect, useState } from "react";
import { CanvasEngineRuntime } from "./CanvasEngineRuntime";

export const useCanvasEngineRuntime = (): CanvasEngineRuntime => {
  const [runtime] = useState(() => new CanvasEngineRuntime());
  useEffect(() => runtime.acquire(), [runtime]);
  return runtime;
};
