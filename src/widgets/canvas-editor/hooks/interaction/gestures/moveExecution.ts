import type { Point } from "@/shared/types";
import type { CanvasMode } from "@/domains/sessions/public";
import type { ToolType } from "@/domains/canvas/public";
import type { CanvasLinkHit } from "../core/linkHitTesting";
import { resolveCanvasMoveDecision, type CanvasMoveDecision } from "./moveInteraction";

export type CanvasMoveExecutor = {
  updateColorPickerHover: (point: Point | null) => void;
  updateLinkHover: (
    hit: CanvasLinkHit | null,
    event: Pick<MouseEvent | KeyboardEvent, "ctrlKey" | "metaKey">
  ) => void;
  setHoveredGrid: (point: Point | null) => void;
  setCursor: (cursor: string) => void;
};

export const createCanvasMoveExecutor = ({
  updateColorPickerHover,
  updateLinkHover,
  setHoveredGrid,
  setCursor,
}: CanvasMoveExecutor): CanvasMoveExecutor => ({
  updateColorPickerHover,
  updateLinkHover,
  setHoveredGrid,
  setCursor,
});

export const executeCanvasMoveDecision = (
  decision: CanvasMoveDecision,
  executor: CanvasMoveExecutor,
  event: Pick<MouseEvent | KeyboardEvent, "ctrlKey" | "metaKey">
): void => {
  if (decision.type === "color-picker-hover") {
    executor.updateColorPickerHover(decision.point);
    return;
  }

  executor.updateLinkHover(decision.linkHit, event);

  switch (decision.action.type) {
    case "structured-text-cursor":
      executor.setCursor("text");
      break;
    case "structured-shape-hover":
      executor.setHoveredGrid(decision.action.point);
      executor.setCursor("crosshair");
      break;
    case "structured-select-hover":
      executor.setCursor(decision.action.cursor);
      break;
    case "eraser-hover":
      executor.setHoveredGrid(decision.action.point);
      break;
    case "none":
      break;
  }
};

type CanvasMoveHandler = ({
  hasColorPickerTarget,
  canvasMode,
  tool,
  point,
  linkHit,
  structuredSelectCursor,
  eraserHoverPoint,
  event,
}: {
  hasColorPickerTarget: boolean;
  canvasMode: CanvasMode;
  tool: ToolType;
  point: Point | null;
  linkHit: CanvasLinkHit | null;
  structuredSelectCursor: string | null;
  eraserHoverPoint: Point | null;
  event: Pick<MouseEvent | KeyboardEvent, "ctrlKey" | "metaKey">;
}) => void;

export const createCanvasMoveHandler = ({
  executor,
}: {
  executor: CanvasMoveExecutor;
}): CanvasMoveHandler => ({
  hasColorPickerTarget,
  canvasMode,
  tool,
  point,
  linkHit,
  structuredSelectCursor,
  eraserHoverPoint,
  event,
}) =>
  executeCanvasMoveDecision(
    resolveCanvasMoveDecision({
      hasColorPickerTarget,
      canvasMode,
      tool,
      point,
      linkHit,
      structuredSelectCursor,
      eraserHoverPoint,
    }),
    executor,
    event
  );
type CanvasMoveRouteContext = {
  point: Point | null;
  linkHit: CanvasLinkHit | null;
  structuredSelectCursor: string | null;
  eraserHoverPoint: Point | null;
};

export type CanvasMoveRouteHandler = ({
  hasColorPickerTarget,
  canvasMode,
  tool,
  clientPoint,
  event,
  resolveMoveContext,
}: {
  hasColorPickerTarget: boolean;
  canvasMode: CanvasMode;
  tool: ToolType;
  clientPoint: Point;
  event: Pick<MouseEvent | KeyboardEvent, "ctrlKey" | "metaKey">;
  resolveMoveContext: (input: {
    clientPoint: Point;
    shouldResolveStructuredSelectCursor: boolean;
    shouldResolveEraserHoverPoint: boolean;
  }) => CanvasMoveRouteContext;
}) => void;

export const createCanvasMoveRouteHandler = ({
  handler,
}: {
  handler: CanvasMoveHandler;
}): CanvasMoveRouteHandler =>
  ({
    hasColorPickerTarget,
    canvasMode,
    tool,
    clientPoint,
    event,
    resolveMoveContext,
  }) => {
    const moveContext = resolveMoveContext({
      clientPoint,
      shouldResolveStructuredSelectCursor:
        canvasMode === "structured" && tool === "select",
      shouldResolveEraserHoverPoint: tool === "eraser",
    });

    handler({
      hasColorPickerTarget,
      canvasMode,
      tool,
      point: moveContext.point,
      linkHit: moveContext.linkHit,
      structuredSelectCursor: moveContext.structuredSelectCursor,
      eraserHoverPoint: moveContext.eraserHoverPoint,
      event,
    });
  };
