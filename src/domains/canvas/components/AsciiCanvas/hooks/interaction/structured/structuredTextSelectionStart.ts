import type { Point, StructuredTextNode } from "@/shared/types";
import {
  getStructuredTextCaretPoint,
  getStructuredTextOffsetAtPoint,
} from "@/shared/utils/structuredTextRanges";
import type { InteractionEvent } from "../core/interactionMachine";
import type { StructuredTextCaretHit } from "./structuredSelectStart";

export type StructuredTextCaretSelectionStart = {
  selectedIds: string[];
  cursor: Point;
  textSelection: null;
  selectionStart: { nodeId: string; offset: number };
  dragStart: Point;
  interactionEvent: InteractionEvent;
};

export const resolveStructuredTextCaretSelectionStart = ({
  node,
  point,
  caretHit,
}: {
  node: StructuredTextNode;
  point: Point;
  caretHit?: StructuredTextCaretHit;
}): StructuredTextCaretSelectionStart => {
  const offset = caretHit?.offset ?? getStructuredTextOffsetAtPoint(node, point);
  const cursor = caretHit?.caretPoint ?? getStructuredTextCaretPoint(node, offset);

  return {
    selectedIds: [node.id],
    cursor,
    textSelection: null,
    selectionStart: { nodeId: node.id, offset },
    dragStart: point,
    interactionEvent: {
      type: "startStructuredTextSelecting",
      nodeId: node.id,
      anchorOffset: offset,
    },
  };
};
