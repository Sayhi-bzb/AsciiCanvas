import type { Point } from "@/shared/types";
import type { CanvasMode } from "@/domains/sessions/public";
import type { ToolType } from "@/domains/canvas/public";
import type { StructuredNode } from "@/domains/structured-content/public";
import {
  createStructuredSceneQuery,
  getStructuredBoxNameEndPoint,
  isPointOnStructuredBoxBorder,
} from "@/domains/structured-content/public";
import type { StructuredTextCaretHit } from "./structuredSelectStart";
import { getStructuredTextCaretHit } from "../core/hitTesting";

export type StructuredEditDecision =
  | { type: "none" }
  | {
      type: "text";
      nodeId: string;
      cursor: Point;
    }
  | {
      type: "box-name";
      nodeId: string;
      cursor: Point;
    };

export const resolveStructuredEditDecision = ({
  point,
  structuredScene,
  selectedStructuredNodeIds,
  editingStructuredTextNodeId,
}: {
  point: Point | null;
  structuredScene: StructuredNode[];
  selectedStructuredNodeIds: string[];
  editingStructuredTextNodeId: string | null;
}): StructuredEditDecision => {
  if (!point) return { type: "none" };
  void selectedStructuredNodeIds;

  const caretHit = getStructuredTextCaretHit({
    point,
    structuredScene,
    preferredNodeId: editingStructuredTextNodeId,
  });
  const hit =
    caretHit?.hit ??
    createStructuredSceneQuery(structuredScene).findHit(point);
  if (!hit) return { type: "none" };

  if (hit.kind === "text") {
    const textCaretHit: StructuredTextCaretHit =
      caretHit?.hit.node.id === hit.node.id
        ? caretHit
        : getStructuredTextCaretHit({
            point,
            structuredScene,
            preferredNodeId: hit.node.id,
          });
    return {
      type: "text",
      nodeId: hit.node.id,
      cursor: textCaretHit?.caretPoint ?? point,
    };
  }

  if (hit.kind !== "box" || !isPointOnStructuredBoxBorder(hit.node, point)) {
    return { type: "none" };
  }

  const cursor = getStructuredBoxNameEndPoint(hit.node);
  return cursor
    ? { type: "box-name", nodeId: hit.node.id, cursor }
    : { type: "none" };
};
export const resolveStructuredEditAttempt = ({
  canvasMode,
  tool,
  point,
  structuredScene,
  selectedStructuredNodeIds,
  editingStructuredTextNodeId,
}: {
  canvasMode: CanvasMode;
  tool: ToolType;
  point: Point | null;
  structuredScene: StructuredNode[];
  selectedStructuredNodeIds: string[];
  editingStructuredTextNodeId: string | null;
}): StructuredEditDecision => {
  if (canvasMode !== "structured" || tool !== "select") {
    return { type: "none" };
  }

  return resolveStructuredEditDecision({
    point,
    structuredScene,
    selectedStructuredNodeIds,
    editingStructuredTextNodeId,
  });
};
