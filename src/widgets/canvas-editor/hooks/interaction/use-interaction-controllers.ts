import { useEffect, useRef, useState } from "react";
import { useCreation } from "ahooks";
import type { EditorState } from "@/domains/canvas/public";
import { MAX_ZOOM, MIN_ZOOM } from "@/shared/lib/constants";
import type { SelectionArea } from "@/shared/types";
import type { CanvasLinkHit } from "./core/linkHitTesting";
import type { InteractionEvent } from "./core/interactionMachine";
import { createCanvasInteractionRuntime } from "./core/interactionRuntime";
import { createCanvasPointerContextResolver } from "./core/pointerContext";
import { createDragResetController } from "./gestures/dragResetExecution";
import { createHoverInteractionController } from "./preview/hoverInteractionController";
import { createSelectionPreviewController } from "./preview/selectionPreviewController";
import type { StructuredMovePreview } from "./structured/structuredInteractionPreview";
import { createStructuredPreviewQueueController } from "./structured/structuredPreviewQueueExecution";
import { createViewportInteractionController } from "./viewport/viewportInteractionController";
import {
  SHORTCUT_PRIORITY,
  useShortcutLayer,
} from "@/shared/shortcuts/dispatcher";

type ControllerStore = Pick<
  EditorState,
  | "tool"
  | "offset"
  | "zoom"
  | "grid"
  | "canvasMode"
  | "setOffset"
  | "setZoom"
  | "setHoveredGrid"
  | "applyStructuredScene"
>;

export const useInteractionControllers = ({
  store,
  containerRef,
  setHoveredLink,
  structuredMovePreviewRef,
  requestRenderRef,
}: {
  store: ControllerStore;
  containerRef: React.RefObject<HTMLDivElement | null>;
  setHoveredLink: (hit: CanvasLinkHit | null) => void;
  structuredMovePreviewRef?: React.MutableRefObject<StructuredMovePreview | null>;
  requestRenderRef?: React.MutableRefObject<(() => void) | null>;
}) => {
  const {
    tool,
    offset,
    zoom,
    grid,
    setOffset,
    setZoom,
    setHoveredGrid,
    applyStructuredScene,
  } = store;
  const colorPickerClickRef = useRef(false);
  const fallbackStructuredMovePreviewRef = useRef<StructuredMovePreview | null>(null);
  const fallbackRequestRenderRef = useRef<(() => void) | null>(null);
  const activeStructuredMovePreviewRef =
    structuredMovePreviewRef ?? fallbackStructuredMovePreviewRef;
  const activeRequestRenderRef = requestRenderRef ?? fallbackRequestRenderRef;
  const [draggingSelection, setDraggingSelection] = useState<SelectionArea | null>(null);

  const pointerContext = useCreation(
    () =>
      createCanvasPointerContextResolver({
        getRect: () => containerRef.current?.getBoundingClientRect(),
        getViewport: () => ({ offset, zoom }),
        getGrid: () => grid,
      }),
    [containerRef, offset, zoom, grid]
  );
  const interactionRuntime = useCreation(createCanvasInteractionRuntime, []);
  const hoverInteraction = useCreation(
    () =>
      createHoverInteractionController({
        getContainer: () => containerRef.current,
        setHoveredLink,
        setHoveredGrid,
      }),
    [containerRef, setHoveredLink, setHoveredGrid]
  );
  const selectionPreview = useCreation(
    () => createSelectionPreviewController({ setPreview: setDraggingSelection }),
    []
  );
  const viewportInteraction = useCreation(
    () =>
      createViewportInteractionController({
        setOffset,
        setZoom,
        zoomBounds: { min: MIN_ZOOM, max: MAX_ZOOM },
      }),
    [setOffset, setZoom]
  );
  const dispatchInteraction = (event: InteractionEvent) => interactionRuntime.dispatch(event);
  const getInteractionState = () => interactionRuntime.getState();
  const clearStructuredMovePreview = () => {
    if (!activeStructuredMovePreviewRef.current) return;
    activeStructuredMovePreviewRef.current = null;
    activeRequestRenderRef.current?.();
  };
  const setStructuredMovePreview = (preview: StructuredMovePreview) => {
    activeStructuredMovePreviewRef.current = preview;
    activeRequestRenderRef.current?.();
  };
  const structuredPreviewQueue = useCreation(
    () =>
      createStructuredPreviewQueueController({
        setStructuredMovePreview,
        applyStructuredScene,
        clearStructuredMovePreview,
      }),
    [activeRequestRenderRef, activeStructuredMovePreviewRef, applyStructuredScene]
  );
  const resetDragState = useCreation(
    () =>
      createDragResetController({
        structuredPreviewQueue,
        clearStructuredMovePreview,
        selectionPreview,
        dispatchInteraction,
      }).reset,
    [selectionPreview, structuredPreviewQueue]
  );

  useShortcutLayer({
    id: "canvas-modifier-observer",
    priority: SHORTCUT_PRIORITY.observer,
    onKeyDown: (event) => {
      hoverInteraction.syncLinkModifierState(event);
      return { claimed: false };
    },
    onKeyUp: (event) => {
      hoverInteraction.syncLinkModifierState(event);
      return { claimed: false };
    },
  });

  useEffect(() => {
    if (interactionRuntime.getState().type !== "panning") {
      hoverInteraction.setCursor(tool === "pan" ? "grab" : "");
    }
  }, [hoverInteraction, interactionRuntime, tool]);

  useEffect(
    () => () => {
      viewportInteraction.cancel();
      structuredPreviewQueue.cancel();
      selectionPreview.cancel();
      hoverInteraction.setCursor("");
    },
    [
      hoverInteraction,
      selectionPreview,
      structuredPreviewQueue,
      viewportInteraction,
    ]
  );

  return {
    colorPickerClickRef,
    dispatchInteraction,
    draggingSelection,
    getInteractionState,
    hoverInteraction,
    interactionRuntime,
    pointerContext,
    resetDragState,
    selectionPreview,
    structuredPreviewQueue,
    viewportInteraction,
  };
};
