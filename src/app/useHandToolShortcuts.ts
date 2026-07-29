import { useEffect, useRef, useState } from "react";
import type { ToolType } from "@/domains/canvas/public";
import type { CanvasMode } from "@/domains/sessions/public";
import { matchesActionShortcut } from "@/domains/actions/public";

const isSpaceKey = (event: Pick<KeyboardEvent, "code" | "key">) =>
  event.code === "Space" || event.key === " ";

const shouldIgnoreHandShortcutTarget = (
  target: EventTarget | null,
  isCanvasTextEditing: boolean
) => {
  if (!(target instanceof HTMLElement)) return false;

  const editable = target.closest(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"])'
  );
  if (!(editable instanceof HTMLElement)) return false;

  if (editable.dataset.canvasManagedInput === "true") {
    return isCanvasTextEditing;
  }

  return true;
};

export const useHandToolShortcuts = ({
  canvasMode,
  isCanvasTextEditing,
  setTool,
}: {
  canvasMode: CanvasMode;
  isCanvasTextEditing: boolean;
  setTool: (tool: ToolType) => void;
}) => {
  const [isTemporaryPanActive, setIsTemporaryPanActive] = useState(false);
  const temporaryPanActiveRef = useRef(false);

  useEffect(() => {
    const setTemporaryPan = (active: boolean) => {
      temporaryPanActiveRef.current = active;
      setIsTemporaryPanActive(active);
    };

    const clearTemporaryPan = () => {
      if (temporaryPanActiveRef.current) setTemporaryPan(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        canvasMode === "animation" ||
        event.defaultPrevented ||
        event.isComposing ||
        shouldIgnoreHandShortcutTarget(event.target, isCanvasTextEditing)
      ) {
        return;
      }

      if (matchesActionShortcut("pan", event)) {
        event.preventDefault();
        setTool("pan");
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

      event.preventDefault();
      if (!event.repeat && !temporaryPanActiveRef.current) {
        setTemporaryPan(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!isSpaceKey(event) || !temporaryPanActiveRef.current) return;
      event.preventDefault();
      setTemporaryPan(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") clearTemporaryPan();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", clearTemporaryPan);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", clearTemporaryPan);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearTemporaryPan();
    };
  }, [canvasMode, isCanvasTextEditing, setTool]);

  return canvasMode === "animation" ? false : isTemporaryPanActive;
};
