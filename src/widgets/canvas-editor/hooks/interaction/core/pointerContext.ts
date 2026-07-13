import type { GridMap, Point } from "@/shared/types";
import type { CanvasMode } from "@/domains/sessions/public";
import type { StructuredNode } from "@/domains/structured-content/public";
import type { AnimationCanvasSize } from "@/domains/animation/public";
import { resolveCanvasLinkHit, type CanvasLinkHit } from "./linkHitTesting";
import {
  getLocalCanvasPoint,
  resolveAnimationAwareHoverGridPoint,
  resolveSnappedGridPointFromScreen,
  type CanvasViewport,
} from "./coordinates";
import { resolveStructuredSelectHit as resolveStructuredSelectHover } from "./hitTesting";

export type CanvasRect = Pick<DOMRect, "left" | "top">;

export type CanvasPointerContextResolver = {
  hasCanvasRect: () => boolean;
  resolveLocalPoint: (clientX: number, clientY: number) => Point | null;
  resolveGridPoint: (clientX: number, clientY: number) => Point | null;
  resolveLinkHit: (clientX: number, clientY: number) => CanvasLinkHit | null;
  resolveAnimationAwareHoverPoint: (
    clientX: number,
    clientY: number
  ) => Point | null;
  resolveMoveContext: (input: {
    clientX: number;
    clientY: number;
    shouldResolveStructuredSelectCursor: boolean;
    shouldResolveEraserHoverPoint: boolean;
    selectedStructuredNodeIds: string[];
    structuredScene: StructuredNode[];
    editingStructuredTextNodeId: string | null;
  }) => {
    point: Point | null;
    linkHit: CanvasLinkHit | null;
    structuredSelectCursor: string | null;
    eraserHoverPoint: Point | null;
  };
};

export const createCanvasPointerContextResolver = ({
  getRect,
  getViewport,
  getGrid,
  getCanvasMode,
  getCanvasBounds,
}: {
  getRect: () => CanvasRect | null | undefined;
  getViewport: () => CanvasViewport;
  getGrid: () => GridMap;
  getCanvasMode: () => CanvasMode;
  getCanvasBounds: () => AnimationCanvasSize | null;
}): CanvasPointerContextResolver => {
  const hasCanvasRect = () => !!getRect();

  const resolveLocalPoint = (clientX: number, clientY: number) => {
    const rect = getRect();
    if (!rect) return null;
    return getLocalCanvasPoint({ clientX, clientY, rect });
  };

  const resolveGridPoint = (clientX: number, clientY: number) => {
    const rect = getRect();
    if (!rect) return null;
    return resolveSnappedGridPointFromScreen({
      clientX,
      clientY,
      rect,
      viewport: getViewport(),
      grid: getGrid(),
      canvasMode: getCanvasMode(),
      canvasBounds: getCanvasBounds(),
    });
  };

  const resolveLinkHit = (clientX: number, clientY: number) => {
    const rect = getRect();
    if (!rect) return null;
    const viewport = getViewport();
    return resolveCanvasLinkHit({
      clientX,
      clientY,
      rect,
      offset: viewport.offset,
      zoom: viewport.zoom,
      grid: getGrid(),
      canvasMode: getCanvasMode(),
      canvasBounds: getCanvasBounds(),
    });
  };

  const resolveAnimationAwareHoverPoint = (
    clientX: number,
    clientY: number
  ) => {
    const rect = getRect();
    if (!rect) return null;
    return resolveAnimationAwareHoverGridPoint({
      clientX,
      clientY,
      rect,
      viewport: getViewport(),
      canvasMode: getCanvasMode(),
      canvasBounds: getCanvasBounds(),
    });
  };

  const resolveMoveContext: CanvasPointerContextResolver["resolveMoveContext"] =
    ({
      clientX,
      clientY,
      shouldResolveStructuredSelectCursor,
      shouldResolveEraserHoverPoint,
      selectedStructuredNodeIds,
      structuredScene,
      editingStructuredTextNodeId,
    }) => {
      const point = resolveGridPoint(clientX, clientY);
      const screenPoint = shouldResolveStructuredSelectCursor
        ? resolveLocalPoint(clientX, clientY)
        : null;
      const viewport = getViewport();
      const structuredSelectCursor = shouldResolveStructuredSelectCursor
        ? resolveStructuredSelectHover({
            screenPoint,
            point,
            selectedStructuredNodeIds,
            structuredScene,
            offset: viewport.offset,
            zoom: viewport.zoom,
            editingStructuredTextNodeId,
          }).cursor
        : null;

      return {
        point,
        linkHit: resolveLinkHit(clientX, clientY),
        structuredSelectCursor,
        eraserHoverPoint: shouldResolveEraserHoverPoint
          ? resolveAnimationAwareHoverPoint(clientX, clientY)
          : null,
      };
    };

  return {
    hasCanvasRect,
    resolveLocalPoint,
    resolveGridPoint,
    resolveLinkHit,
    resolveAnimationAwareHoverPoint,
    resolveMoveContext,
  };
};



