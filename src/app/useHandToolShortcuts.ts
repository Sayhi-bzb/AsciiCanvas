import { useCallback, useEffect, useRef, useState } from "react";
import {
  SHORTCUT_PRIORITY,
  useShortcutLayer,
} from "@/shared/shortcuts/dispatcher";

const isSpaceKey = (event: Pick<KeyboardEvent, "code" | "key">) =>
  event.code === "Space" || event.key === " ";

export const useHandToolShortcuts = ({
  isCanvasTextEditing,
}: {
  isCanvasTextEditing: boolean;
}) => {
  const [isTemporaryPanActive, setIsTemporaryPanActive] = useState(false);
  const temporaryPanActiveRef = useRef(false);

  const setTemporaryPan = (active: boolean) => {
    temporaryPanActiveRef.current = active;
    setIsTemporaryPanActive(active);
  };
  const clearTemporaryPan = useCallback(() => {
    if (temporaryPanActiveRef.current === false) return;
    temporaryPanActiveRef.current = false;
    setIsTemporaryPanActive(false);
  }, []);

  useShortcutLayer({
    id: "hand-tool",
    priority: SHORTCUT_PRIORITY.canvasGesture,
    onKeyDown: (event, context) => {
      if (
        context.targetKind === "editable" ||
        context.targetKind === "overlay" ||
        (context.targetKind === "managed-canvas" && isCanvasTextEditing)
      ) {
        return;
      }
      if (
        !isSpaceKey(event) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }
      if (!event.repeat && !temporaryPanActiveRef.current) {
        setTemporaryPan(true);
      }
      return { claimed: true, preventDefault: true };
    },
    onKeyUp: (event) => {
      if (!isSpaceKey(event) || !temporaryPanActiveRef.current) return;
      setTemporaryPan(false);
      return { claimed: true, preventDefault: true };
    },
  });

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") clearTemporaryPan();
    };
    window.addEventListener("blur", clearTemporaryPan);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("blur", clearTemporaryPan);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearTemporaryPan();
    };
  }, [clearTemporaryPan]);

  return isTemporaryPanActive;
};
