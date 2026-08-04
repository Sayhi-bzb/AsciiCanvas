import type { GridMap, Point } from "@/shared/types";
import type { StructuredNode } from "@/domains/structured-content/public";
import { resolveCanvasLinkHit, type CanvasLinkHit } from "./linkHitTesting";
import {
  getLocalCanvasPoint,
  resolveHoverGridPoint,
  resolveSnappedGridPointFromScreen,
  type CanvasViewport,
} from "./coordinates";
import { resolveStructuredSelectHit as resolveStructuredSelectHover } from "./hitTesting";

type CanvasRect = Pick<DOMRect, "left" | "top">;

export type CanvasPointerContextResolver = {
  hasCanvasRect: () => boolean;
  resolveLocalPoint: (clientX: number, clientY: number) => Point | null;
  resolveGridPoint: (clientX: number, clientY: number) => Point | null;
  resolveLinkHit: (clientX: number, clientY: number) => CanvasLinkHit | null;
  resolveHoverPoint: (
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
}: {
  getRect: () => CanvasRect | null | undefined;
  getViewport: () => CanvasViewport;
  getGrid: () => GridMap;
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
    });
  };

  const resolveHoverPoint = (
    clientX: number,
    clientY: number
  ) => {
    const rect = getRect();
    if (!rect) return null;
    return resolveHoverGridPoint({
      clientX,
      clientY,
      rect,
      viewport: getViewport(),
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
          ? resolveHoverPoint(clientX, clientY)
          : null,
      };
    };

  return {
    hasCanvasRect,
    resolveLocalPoint,
    resolveGridPoint,
    resolveLinkHit,
    resolveHoverPoint,
    resolveMoveContext,
  };
};



