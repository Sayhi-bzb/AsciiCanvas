import {
  CHARDESK_DOCUMENT_TYPE,
  CHARDESK_DOCUMENT_VERSION,
} from "./types";
import type {
  CharDeskDocumentV1,
  CharDeskDocumentCellV1,
  CharDeskDocumentNodeV1,
} from "./types";

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isPoint = (value: unknown): value is { x: number; y: number } => {
  return (
    isObject(value) &&
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    typeof value.y === "number" &&
    Number.isFinite(value.y)
  );
};

const isProtocolCell = (value: unknown): value is CharDeskDocumentCellV1 => {
  return (
    isObject(value) &&
    typeof value.char === "string" &&
    typeof value.color === "string" &&
    hasOptionalStyleFields(value) &&
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    typeof value.y === "number" &&
    Number.isFinite(value.y)
  );
};

const isTextAttributes = (value: unknown) => {
  if (value === undefined) return true;
  if (!isObject(value)) return false;
  return ["bold", "italic", "underline", "strike", "inverse"].every(
    (key) => value[key] === undefined || value[key] === true
  );
};

const hasOptionalStyleFields = (value: Record<string, unknown>) => {
  return (
    (value.bgColor === undefined || typeof value.bgColor === "string") &&
    isTextAttributes(value.attrs) &&
    (value.href === undefined || typeof value.href === "string")
  );
};

const isProtocolNodeStyle = (value: unknown): value is { color: string } => {
  return (
    isObject(value) &&
    typeof value.color === "string" &&
    hasOptionalStyleFields(value)
  );
};

const isComponentMetadata = (value: unknown) => {
  if (value === undefined) return true;
  return (
    isObject(value) &&
    typeof value.instanceId === "string" &&
    typeof value.templateId === "string" &&
    typeof value.role === "string"
  );
};

const isStructuredComponentInstance = (value: unknown) => {
  if (!isObject(value)) return false;
  if (
    typeof value.id !== "string" ||
    typeof value.templateId !== "string" ||
    typeof value.label !== "string" ||
    !Array.isArray(value.atomIds) ||
    !value.atomIds.every((id) => typeof id === "string") ||
    !isObject(value.roles)
  ) {
    return false;
  }
  return Object.values(value.roles).every(
    (ids) => Array.isArray(ids) && ids.every((id) => typeof id === "string")
  );
};

const isStructuredTextStyleRange = (value: unknown) => {
  if (!isObject(value)) return false;
  if (typeof value.start !== "number" || !Number.isFinite(value.start)) return false;
  if (typeof value.end !== "number" || !Number.isFinite(value.end)) return false;
  if (!isObject(value.style)) return false;
  return (
    (value.style.color === undefined || typeof value.style.color === "string") &&
    hasOptionalStyleFields(value.style)
  );
};

const isStructuredSplitBoxTreeNode = (value: unknown): boolean => {
  if (!isObject(value)) return false;
  if (value.type === "leaf") return typeof value.id === "string";
  if (value.type !== "split") return false;
  return (
    typeof value.id === "string" &&
    (value.axis === "horizontal" || value.axis === "vertical") &&
    typeof value.ratio === "number" &&
    Number.isFinite(value.ratio) &&
    isStructuredSplitBoxTreeNode(value.first) &&
    isStructuredSplitBoxTreeNode(value.second)
  );
};

const isStructuredNode = (value: unknown): value is CharDeskDocumentNodeV1 => {
  if (!isObject(value)) return false;
  if (typeof value.id !== "string") return false;
  if (typeof value.order !== "number" || !Number.isFinite(value.order)) {
    return false;
  }
  if (!isProtocolNodeStyle(value.style)) return false;
  if (!isComponentMetadata(value.component)) return false;
  if (value.type === "box") {
    return (
      isPoint(value.start) &&
      isPoint(value.end) &&
      (value.name === undefined || typeof value.name === "string")
    );
  }
  if (value.type === "splitBox") {
    return (
      isPoint(value.start) &&
      isPoint(value.end) &&
      typeof value.verticalSplitRatio === "number" &&
      Number.isFinite(value.verticalSplitRatio) &&
      typeof value.topSplitRatio === "number" &&
      Number.isFinite(value.topSplitRatio) &&
      typeof value.bottomSplitRatio === "number" &&
      Number.isFinite(value.bottomSplitRatio) &&
      (value.root === undefined || isStructuredSplitBoxTreeNode(value.root))
    );
  }
  if (value.type === "line") {
    return (
      isPoint(value.start) &&
      isPoint(value.end) &&
      (value.axis === "vertical" || value.axis === "horizontal") &&
      (value.endMarker === undefined || value.endMarker === "arrow")
    );
  }
  if (value.type === "bg") {
    return isPoint(value.start) && isPoint(value.end);
  }
  if (value.type === "text") {
    return (
      isPoint(value.position) &&
      typeof value.text === "string" &&
      (value.styleRanges === undefined ||
        (Array.isArray(value.styleRanges) &&
          value.styleRanges.every(isStructuredTextStyleRange)))
    );
  }
  return false;
};

export const isCharDeskDocument = (
  value: unknown
): value is CharDeskDocumentV1 => {
  if (!isObject(value)) return false;
  if (value.type !== CHARDESK_DOCUMENT_TYPE) return false;
  if (value.version !== CHARDESK_DOCUMENT_VERSION) return false;

  if (value.mode === "freeform") {
    return Array.isArray(value.cells) && value.cells.every(isProtocolCell);
  }

  if (value.mode === "structured") {
    return (
      Array.isArray(value.nodes) &&
      value.nodes.every(isStructuredNode) &&
      (value.components === undefined ||
        (Array.isArray(value.components) &&
          value.components.every(isStructuredComponentInstance)))
    );
  }

  return false;
};
