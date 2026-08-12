import type { Point, TextAttributes } from "@/shared/types";
import type { CanvasMode } from "@/domains/sessions/public";
import type { StructuredComponentInstance, StructuredSplitBoxTreeNode, StructuredTextStyleRange } from "@/domains/structured-content/public";

export const CHARDESK_DOCUMENT_TYPE = "chardesk-document";
export const CHARDESK_DOCUMENT_VERSION = 1;

type CharDeskDocumentType = typeof CHARDESK_DOCUMENT_TYPE;
type CharDeskDocumentVersion = typeof CHARDESK_DOCUMENT_VERSION;

export interface CharDeskDocumentCellV1 {
  x: number;
  y: number;
  char: string;
  color: string;
  bgColor?: string;
  attrs?: TextAttributes;
  href?: string;
}

interface CharDeskDocumentStyleV1 {
  color: string;
  bgColor?: string;
  attrs?: TextAttributes;
}

interface CharDeskDocumentComponentMetadataV1 {
  instanceId: string;
  templateId: string;
  role: string;
}

interface CharDeskDocumentNodeBaseV1 {
  id: string;
  order: number;
  style: CharDeskDocumentStyleV1;
  component?: CharDeskDocumentComponentMetadataV1;
}

interface CharDeskDocumentBoxNodeV1
  extends CharDeskDocumentNodeBaseV1 {
  type: "box";
  start: Point;
  end: Point;
  name?: string;
}

interface CharDeskDocumentSplitBoxNodeV1
  extends CharDeskDocumentNodeBaseV1 {
  type: "splitBox";
  start: Point;
  end: Point;
  verticalSplitRatio: number;
  topSplitRatio: number;
  bottomSplitRatio: number;
  root?: StructuredSplitBoxTreeNode;
}

interface CharDeskDocumentLineNodeV1
  extends CharDeskDocumentNodeBaseV1 {
  type: "line";
  start: Point;
  end: Point;
  axis: "vertical" | "horizontal";
  endMarker?: "arrow";
}

interface CharDeskDocumentBgNodeV1
  extends CharDeskDocumentNodeBaseV1 {
  type: "bg";
  start: Point;
  end: Point;
}

interface CharDeskDocumentTextNodeV1
  extends CharDeskDocumentNodeBaseV1 {
  type: "text";
  position: Point;
  text: string;
  styleRanges?: StructuredTextStyleRange[];
}

export type CharDeskDocumentNodeV1 =
  | CharDeskDocumentBoxNodeV1
  | CharDeskDocumentSplitBoxNodeV1
  | CharDeskDocumentLineNodeV1
  | CharDeskDocumentBgNodeV1
  | CharDeskDocumentTextNodeV1;

interface CharDeskDocumentBaseV1<TMode extends CanvasMode> {
  type: CharDeskDocumentType;
  version: CharDeskDocumentVersion;
  mode: TMode;
}

export interface CharDeskFreeformDocumentV1
  extends CharDeskDocumentBaseV1<"freeform"> {
  cells: CharDeskDocumentCellV1[];
}

export interface CharDeskStructuredDocumentV1
  extends CharDeskDocumentBaseV1<"structured"> {
  nodes: CharDeskDocumentNodeV1[];
  components?: StructuredComponentInstance[];
}

export type CharDeskDocumentV1 =
  | CharDeskFreeformDocumentV1
  | CharDeskStructuredDocumentV1;
