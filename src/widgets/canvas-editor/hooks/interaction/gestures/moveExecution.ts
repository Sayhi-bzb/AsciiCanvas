import type { Point } from "@/shared/types";
import type { CanvasMode } from "@/domains/sessions/public";
import type { ToolType } from "@/domains/canvas/public";
import type { CanvasLinkHit } from "../core/linkHitTesting";
import { resolveCanvasMoveDecision, type CanvasMoveDecision } from "./moveInteraction";

export type CanvasMoveExecutor = {
  updateColorPickerHover: (point: Point | null) => void;
  updateLinkHover: (hit: CanvasLinkHit | null) => void;
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
  executor: CanvasMoveExecutor
): void => {
  if (decision.type === "color-picker-hover") {
    executor.updateColorPickerHover(decision.point);
    return;
  }

  executor.updateLinkHover(decision.linkHit);

  switch (decision.action.type) {
    case "pan-hover":
      executor.setCursor("grab");
      break;
    case "structured-text-cursor":
      executor.setCursor("text");
      break;
    case "structured-shape-hover":
      executor.setHoveredGrid(decision.action.point);
      executor.setCursor("crosshair");
      break;
    case "structured-select-hover":
      if (decision.action.cursor) executor.setCursor(decision.action.cursor);
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
}: {
  hasColorPickerTarget: boolean;
  canvasMode: CanvasMode;
  tool: ToolType;
  point: Point | null;
  linkHit: CanvasLinkHit | null;
  structuredSelectCursor: string | null;
  eraserHoverPoint: Point | null;
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
    executor
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
  resolveMoveContext,
}: {
  hasColorPickerTarget: boolean;
  canvasMode: CanvasMode;
  tool: ToolType;
  clientPoint: Point;
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
    });
  };
