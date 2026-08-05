/* eslint-disable react-refresh/only-export-components */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from "react";
import {
  classifyShortcutTarget,
  type ShortcutTargetKind,
} from "@/shared/utils/dom-focus";

export type ShortcutPhase = "keydown" | "keyup";

export type ShortcutDispatchContext = {
  phase: ShortcutPhase;
  targetKind: ShortcutTargetKind;
};

export type ShortcutDispatchResult = {
  claimed: boolean;
  preventDefault?: boolean;
};

export type ShortcutLayer = {
  id: string;
  priority: number;
  enabled?: boolean;
  onKeyDown?: (
    event: KeyboardEvent,
    context: ShortcutDispatchContext
  ) => ShortcutDispatchResult | undefined;
  onKeyUp?: (
    event: KeyboardEvent,
    context: ShortcutDispatchContext
  ) => ShortcutDispatchResult | undefined;
};

export const SHORTCUT_PRIORITY = {
  observer: 1_000,
  presentation: 800,
  managedCanvas: 400,
  dynamicCanvasCommand: 300,
  globalAction: 200,
  canvasGesture: 100,
  chrome: 50,
} as const;

type LayerEntry = {
  order: number;
  ref: MutableRefObject<ShortcutLayer>;
};

type ShortcutDispatcherContextValue = {
  register: (token: symbol, ref: MutableRefObject<ShortcutLayer>) => () => void;
};

const ShortcutDispatcherContext =
  createContext<ShortcutDispatcherContextValue | null>(null);

export function ShortcutProvider({ children }: { children: ReactNode }) {
  const layersRef = useRef(new Map<symbol, LayerEntry>());
  const nextOrderRef = useRef(0);

  const register = useCallback(
    (token: symbol, ref: MutableRefObject<ShortcutLayer>) => {
      layersRef.current.set(token, {
        order: nextOrderRef.current++,
        ref,
      });
      return () => {
        layersRef.current.delete(token);
      };
    },
    []
  );

  useEffect(() => {
    const dispatch = (phase: ShortcutPhase, event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;

      const layers = [...layersRef.current.values()].sort(
        (left, right) =>
          right.ref.current.priority - left.ref.current.priority ||
          left.order - right.order
      );
      const context: ShortcutDispatchContext = {
        phase,
        targetKind: classifyShortcutTarget(event.target),
      };

      for (const entry of layers) {
        const layer = entry.ref.current;
        if (layer.enabled === false) continue;
        const handler = phase === "keydown" ? layer.onKeyDown : layer.onKeyUp;
        const result = handler?.(event, context);
        if (!result?.claimed) continue;
        if (result.preventDefault) event.preventDefault();
        break;
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => dispatch("keydown", event);
    const handleKeyUp = (event: KeyboardEvent) => dispatch("keyup", event);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, []);

  const value = useMemo(() => ({ register }), [register]);
  return (
    <ShortcutDispatcherContext.Provider value={value}>
      {children}
    </ShortcutDispatcherContext.Provider>
  );
}

export function useShortcutLayer(layer: ShortcutLayer) {
  const dispatcher = useContext(ShortcutDispatcherContext);
  if (!dispatcher) {
    throw new Error("useShortcutLayer must be used within a ShortcutProvider.");
  }
  const tokenRef = useRef<symbol | null>(null);
  if (tokenRef.current === null) tokenRef.current = Symbol(layer.id);
  const layerRef = useRef(layer);
  layerRef.current = layer;

  useEffect(
    () => dispatcher.register(tokenRef.current as symbol, layerRef),
    [dispatcher]
  );
}
