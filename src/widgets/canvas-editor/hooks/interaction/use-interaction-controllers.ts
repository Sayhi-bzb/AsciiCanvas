import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import type { CanvasEngineRuntime } from "../../engine/CanvasEngineRuntime";
import {
  CANVAS_FRAME_INVALIDATION,
  createFrameSchedulerRafAdapter,
} from "../../engine/FrameScheduler";

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
> & { slideDeck?: EditorState["slideDeck"] };

export const useInteractionControllers = ({
  store,
  containerRef,
  setHoveredLink,
  structuredMovePreviewRef,
  requestRenderRef,
  runtime,
}: {
  store: ControllerStore;
  containerRef: React.RefObject<HTMLDivElement | null>;
  setHoveredLink: (hit: CanvasLinkHit | null) => void;
  structuredMovePreviewRef?: React.MutableRefObject<StructuredMovePreview | null>;
  requestRenderRef?: React.MutableRefObject<(() => void) | null>;
  runtime?: CanvasEngineRuntime;
}) => {
  const {
    tool,
    offset,
    zoom,
    grid,
    canvasMode,
    slideDeck,
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
  const pointerInputsRef = useRef({ offset, zoom, grid, canvasMode, slideDeck });
  useLayoutEffect(() => {
    pointerInputsRef.current = { offset, zoom, grid, canvasMode, slideDeck };
  }, [canvasMode, grid, offset, slideDeck, zoom]);
  const viewportScheduler = useCreation(
    () =>
      runtime
        ? createFrameSchedulerRafAdapter(
            runtime.frameScheduler,
            "viewport-interaction",
            CANVAS_FRAME_INVALIDATION.presentation
          )
        : undefined,
    [runtime]
  );
  const previewScheduler = useCreation(
    () =>
      runtime
        ? createFrameSchedulerRafAdapter(
            runtime.frameScheduler,
            "structured-preview",
            CANVAS_FRAME_INVALIDATION.overlay
          )
        : undefined,
    [runtime]
  );

  const pointerContext = useCreation(
    () =>
      createCanvasPointerContextResolver({
        getRect: () => containerRef.current?.getBoundingClientRect(),
        getViewport: () => ({
          offset: pointerInputsRef.current.offset,
          zoom: pointerInputsRef.current.zoom,
        }),
        getGrid: () => pointerInputsRef.current.grid,
        getGridBounds: () => {
          const current = pointerInputsRef.current;
          return current.canvasMode === "slide" && current.slideDeck
            ? current.slideDeck.slides.find(
                (slide) => slide.id === current.slideDeck?.activeSlideId
              )?.size ?? null
            : null;
        },
      }),
    [containerRef]
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
        scheduler: viewportScheduler,
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
        scheduler: previewScheduler,
      }),
    [
      activeRequestRenderRef,
      activeStructuredMovePreviewRef,
      applyStructuredScene,
      previewScheduler,
    ]
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

  useEffect(() => {
    const manager = {
      dispose: () => {
        viewportInteraction.cancel();
        structuredPreviewQueue.cancel();
        selectionPreview.cancel();
        hoverInteraction.setCursor("");
      },
    };
    runtime?.registerManager("interaction", manager);
    return () => {
      if (runtime) runtime.unregisterManager("interaction", manager);
      else manager.dispose();
    };
  }, [
    hoverInteraction,
    runtime,
    selectionPreview,
    structuredPreviewQueue,
    viewportInteraction,
  ]);

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
