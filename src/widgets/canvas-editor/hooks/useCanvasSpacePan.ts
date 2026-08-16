import { useCallback, useEffect, useRef, useState } from "react";
import {
  SHORTCUT_PRIORITY,
  useShortcutLayer,
} from "@/shared/shortcuts/dispatcher";

const isSpaceKey = (event: Pick<KeyboardEvent, "code" | "key">) =>
  event.code === "Space" || event.key === " ";

export const useCanvasSpacePan = ({ enabled }: { enabled: boolean }) => {
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);

  const setTemporaryPan = useCallback((next: boolean) => {
    if (activeRef.current === next) return;
    activeRef.current = next;
    setActive(next);
  }, []);

  useShortcutLayer({
    id: "canvas-space-pan",
    priority: SHORTCUT_PRIORITY.canvasGesture,
    enabled,
    onKeyDown: (event, context) => {
      if (
        context.targetKind !== "managed-canvas" ||
        !isSpaceKey(event) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }
      if (!event.repeat) setTemporaryPan(true);
      return { claimed: true, preventDefault: true };
    },
    onKeyUp: (event) => {
      if (!isSpaceKey(event) || !activeRef.current) return;
      setTemporaryPan(false);
      return { claimed: true, preventDefault: true };
    },
  });

  useEffect(() => {
    if (enabled || !activeRef.current) return;
    queueMicrotask(() => setTemporaryPan(false));
  }, [enabled, setTemporaryPan]);

  useEffect(() => {
    const clearTemporaryPan = () => setTemporaryPan(false);
    const clearWhenHidden = () => {
      if (document.visibilityState !== "visible") clearTemporaryPan();
    };
    window.addEventListener("blur", clearTemporaryPan);
    document.addEventListener("visibilitychange", clearWhenHidden);
    return () => {
      window.removeEventListener("blur", clearTemporaryPan);
      document.removeEventListener("visibilitychange", clearWhenHidden);
      activeRef.current = false;
    };
  }, [setTemporaryPan]);

  return enabled && active;
};
