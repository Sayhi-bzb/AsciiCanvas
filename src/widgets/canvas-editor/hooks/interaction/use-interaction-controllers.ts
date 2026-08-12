import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useCreation } from "ahooks";
import { canvasCommands } from "@/domains/canvas/public";
import { MAX_ZOOM, MIN_ZOOM } from "@/shared/lib/constants";
import type { SelectionArea } from "@/shared/types";
import type { CanvasLinkHit } from "./core/linkHitTesting";
import type { InteractionEvent } from "./core/interactionMachine";
import { createCanvasInteractionRuntime } from "./core/interactionRuntime";
import { createCanvasInteractionTransactionController } from "./core/interactionTransaction";
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
import { CanvasEdgeScrollManager } from "../../engine/CanvasEdgeScrollManager";
import {
  CANVAS_FRAME_INVALIDATION,
  createFrameSchedulerRafAdapter,
} from "../../engine/FrameScheduler";
import type { useCanvasEditorModels } from "../useCanvasEditorModels";

type ControllerStore = Pick<
  ReturnType<typeof useCanvasEditorModels>["interaction"],
  | "tool"
  | "offset"
  | "zoom"
  | "grid"
  | "canvasMode"
  | "setOffset"
  | "setViewport"
  | "setHoveredGrid"
  | "applyStructuredScene"
> & {
  activeCanvasId?: ReturnType<typeof useCanvasEditorModels>["interaction"]["activeCanvasId"];
  slideDeck?: ReturnType<typeof useCanvasEditorModels>["interaction"]["slideDeck"];
};

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
    activeCanvasId,
    offset,
    zoom,
    grid,
    canvasMode,
    slideDeck,
    setOffset,
    setViewport,
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
  const hoverOutputsRef = useRef({ setHoveredLink, setHoveredGrid });
  useLayoutEffect(() => {
    pointerInputsRef.current = { offset, zoom, grid, canvasMode, slideDeck };
    hoverOutputsRef.current = { setHoveredLink, setHoveredGrid };
  }, [
    canvasMode,
    grid,
    offset,
    setHoveredGrid,
    setHoveredLink,
    slideDeck,
    zoom,
  ]);
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
        setHoveredLink: (hit) => hoverOutputsRef.current.setHoveredLink(hit),
        setHoveredGrid: (point) => hoverOutputsRef.current.setHoveredGrid(point),
      }),
    [containerRef]
  );
  const selectionPreview = useCreation(
    () => createSelectionPreviewController({ setPreview: setDraggingSelection }),
    []
  );
  const viewportInteraction = useCreation(
    () => {
      if (runtime) {
        return {
          queueOffsetDelta: (dx: number, dy: number) =>
            runtime.camera.queuePan(dx, dy),
          flushOffset: () => runtime.camera.flushPan(),
          queueZoomDelta: (delta: number, x: number, y: number) =>
            runtime.camera.queueZoomAt(delta, { x, y }),
          flushZoom: () => runtime.camera.flushZoom(),
          cancel: () => runtime.camera.cancelPending(),
        };
      }
      return createViewportInteractionController({
        setOffset,
        setViewport,
        zoomBounds: { min: MIN_ZOOM, max: MAX_ZOOM },
      });
    },
    [runtime, setOffset, setViewport]
  );
  const dispatchInteraction = (event: InteractionEvent) => interactionRuntime.dispatch(event);
  const getInteractionState = () => interactionRuntime.getState();
  const structuredPreview = useCreation(
    () => {
      const clear = () => {
        if (!activeStructuredMovePreviewRef.current) return;
        activeStructuredMovePreviewRef.current = null;
        activeRequestRenderRef.current?.();
      };
      const queue = createStructuredPreviewQueueController({
        setStructuredMovePreview: (preview) => {
          activeStructuredMovePreviewRef.current = preview;
          activeRequestRenderRef.current?.();
        },
        applyStructuredScene,
        clearStructuredMovePreview: clear,
        scheduler: previewScheduler,
      });
      return { clear, queue };
    },
    [
      activeRequestRenderRef,
      activeStructuredMovePreviewRef,
      applyStructuredScene,
      previewScheduler,
    ]
  );
  const structuredPreviewQueue = structuredPreview.queue;
  const resetDragState = useCreation(
    () =>
      createDragResetController({
        structuredPreviewQueue,
        clearStructuredMovePreview: structuredPreview.clear,
        selectionPreview,
        dispatchInteraction,
      }).reset,
    [selectionPreview, structuredPreview, structuredPreviewQueue]
  );
  const interactionTransaction = useCreation(
    () =>
      createCanvasInteractionTransactionController({
        createCheckpoint: canvasCommands.history.beginCheckpoint,
      }),
    []
  );
  const edgeScroll = useCreation(
    () =>
      runtime
        ? new CanvasEdgeScrollManager(runtime.frameScheduler, runtime.camera)
        : null,
    [runtime]
  );
  const cancelInteraction = useCallback(() => {
    edgeScroll?.stop();
    viewportInteraction.cancel();
    interactionTransaction.cancel();
    resetDragState();
    hoverInteraction.clearLinkHover();
    hoverInteraction.setCursor(tool === "pan" ? "grab" : "");
  }, [
    edgeScroll,
    hoverInteraction,
    interactionTransaction,
    resetDragState,
    tool,
    viewportInteraction,
  ]);
  const beginInteraction = useCallback(() => {
    if (interactionTransaction.hasActive()) cancelInteraction();
    edgeScroll?.stop();
    interactionTransaction.begin();
  }, [cancelInteraction, edgeScroll, interactionTransaction]);
  const completeInteraction = useCallback(() => {
    edgeScroll?.stop();
    interactionTransaction.complete();
  }, [edgeScroll, interactionTransaction]);
  const interactionIdentityRef = useRef({
    activeCanvasId,
    activeSlideId: slideDeck?.activeSlideId,
    canvasMode,
    tool,
  });

  useEffect(() => {
    const nextIdentity = {
      activeCanvasId,
      activeSlideId: slideDeck?.activeSlideId,
      canvasMode,
      tool,
    };
    const previous = interactionIdentityRef.current;
    interactionIdentityRef.current = nextIdentity;
    if (
      interactionTransaction.hasActive() &&
      (previous.activeCanvasId !== nextIdentity.activeCanvasId ||
        previous.activeSlideId !== nextIdentity.activeSlideId ||
        previous.canvasMode !== nextIdentity.canvasMode ||
        previous.tool !== nextIdentity.tool)
    ) {
      cancelInteraction();
    }
  }, [
    activeCanvasId,
    cancelInteraction,
    canvasMode,
    interactionTransaction,
    slideDeck?.activeSlideId,
    tool,
  ]);

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

  useShortcutLayer({
    id: "canvas-active-interaction-cancel",
    priority: SHORTCUT_PRIORITY.canvasInteraction,
    onKeyDown: (event, context) => {
      if (
        event.key !== "Escape" ||
        !interactionTransaction.hasActive() ||
        context.targetKind === "editable" ||
        context.targetKind === "overlay"
      ) {
        return { claimed: false };
      }
      cancelInteraction();
      return { claimed: true, preventDefault: true };
    },
  });

  useEffect(() => {
    const cancelOnBlur = () => {
      if (interactionTransaction.hasActive()) cancelInteraction();
    };
    const cancelWhenHidden = () => {
      if (document.visibilityState === "hidden") cancelOnBlur();
    };
    window.addEventListener("blur", cancelOnBlur);
    document.addEventListener("visibilitychange", cancelWhenHidden);
    return () => {
      window.removeEventListener("blur", cancelOnBlur);
      document.removeEventListener("visibilitychange", cancelWhenHidden);
    };
  }, [cancelInteraction, interactionTransaction]);

  useEffect(() => {
    if (interactionRuntime.getState().type !== "panning") {
      hoverInteraction.setCursor(tool === "pan" ? "grab" : "");
    }
  }, [hoverInteraction, interactionRuntime, tool]);

  useEffect(() => {
    const manager = {
      dispose: () => {
        interactionTransaction.cancel();
        edgeScroll?.dispose();
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
    edgeScroll,
    interactionTransaction,
    runtime,
    selectionPreview,
    structuredPreviewQueue,
    viewportInteraction,
  ]);

  return {
    colorPickerClickRef,
    beginInteraction,
    cancelInteraction,
    completeInteraction,
    dispatchInteraction,
    draggingSelection,
    edgeScroll,
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
