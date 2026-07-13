import type { Point } from "@/shared/types";
import type { StructuredNode } from "@/domains/structured-content/public";
import type {
  StructuredNodeHit,
} from "@/domains/structured-content/public";
import {
  resolveStructuredSelectHit,
  type getStructuredTextCaretHit,
} from "../core/hitTesting";
import {
  resolveStructuredDragStartDecision,
  type StructuredDragStartDecision,
} from "./structuredDragStart";

export type StructuredTextCaretHit = ReturnType<typeof getStructuredTextCaretHit>;

export type StructuredSelectStartDecision =
  | { type: "none" }
  | { type: "clear-empty" }
  | { type: "double-click-text"; nodeId: string }
  | {
      type: "text-caret-selection";
      node: Extract<StructuredNode, { type: "text" }>;
      caretHit: StructuredTextCaretHit;
    }
  | {
      type: "node-drag";
      dragStart: StructuredDragStartDecision;
      cursor: string;
    };

export const resolveStructuredSelectStartDecision = ({
  hit,
  caretHit,
  start,
  mouseDetail,
  editingStructuredTextNodeId,
  selectedStructuredNodeIds,
  structuredScene,
  cursor,
}: {
  hit: StructuredNodeHit | null;
  caretHit: StructuredTextCaretHit;
  start: Point;
  mouseDetail: number;
  editingStructuredTextNodeId: string | null;
  selectedStructuredNodeIds: string[];
  structuredScene: StructuredNode[];
  cursor: string;
}): StructuredSelectStartDecision => {
  if (!hit) return { type: "clear-empty" };

  if (hit.kind === "text" && mouseDetail >= 2) {
    return { type: "double-click-text", nodeId: hit.node.id };
  }

  if (hit.kind === "text" && editingStructuredTextNodeId === hit.node.id) {
    return {
      type: "text-caret-selection",
      node: hit.node,
      caretHit,
    };
  }

  return {
    type: "node-drag",
    dragStart: resolveStructuredDragStartDecision({
      hit,
      start,
      selectedStructuredNodeIds,
      structuredScene,
    }),
    cursor,
  };
};

export const resolveStructuredSelectStartContext = ({
  screenPoint,
  start,
  selectedStructuredNodeIds,
  structuredScene,
  offset,
  zoom,
  editingStructuredTextNodeId,
  mouseDetail,
}: {
  screenPoint: Point | null;
  start: Point;
  selectedStructuredNodeIds: string[];
  structuredScene: StructuredNode[];
  offset: Point;
  zoom: number;
  editingStructuredTextNodeId: string | null;
  mouseDetail: number;
}) => {
  const hitResult = resolveStructuredSelectHit({
    screenPoint,
    point: start,
    selectedStructuredNodeIds,
    structuredScene,
    offset,
    zoom,
    editingStructuredTextNodeId,
    includeCaretBehindHandle: false,
  });

  return {
    hitResult,
    decision: resolveStructuredSelectStartDecision({
      hit: hitResult.hit,
      caretHit: hitResult.caretHit,
      start,
      mouseDetail,
      editingStructuredTextNodeId,
      selectedStructuredNodeIds,
      structuredScene,
      cursor: hitResult.cursor,
    }),
  };
};
