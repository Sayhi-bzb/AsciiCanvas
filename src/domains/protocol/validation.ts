import {
  ASCII_CANVAS_DOCUMENT_TYPE,
  ASCII_CANVAS_DOCUMENT_VERSION,
} from "./types";
import type {
  AsciiCanvasDocumentV1,
  AsciiCanvasProtocolCellV1,
  AsciiCanvasProtocolNodeV1,
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

const isProtocolCell = (value: unknown): value is AsciiCanvasProtocolCellV1 => {
  return (
    isObject(value) &&
    typeof value.char === "string" &&
    typeof value.color === "string" &&
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    typeof value.y === "number" &&
    Number.isFinite(value.y)
  );
};

const isProtocolNodeStyle = (value: unknown): value is { color: string } => {
  return isObject(value) && typeof value.color === "string";
};

const isStructuredNode = (value: unknown): value is AsciiCanvasProtocolNodeV1 => {
  if (!isObject(value)) return false;
  if (typeof value.id !== "string") return false;
  if (typeof value.order !== "number" || !Number.isFinite(value.order)) {
    return false;
  }
  if (!isProtocolNodeStyle(value.style)) return false;
  if (value.type === "box") {
    return (
      isPoint(value.start) &&
      isPoint(value.end) &&
      (value.name === undefined || typeof value.name === "string")
    );
  }
  if (value.type === "line") {
    return (
      isPoint(value.start) &&
      isPoint(value.end) &&
      (value.axis === "vertical" || value.axis === "horizontal")
    );
  }
  if (value.type === "text") {
    return isPoint(value.position) && typeof value.text === "string";
  }
  return false;
};

export const isAsciiCanvasDocument = (
  value: unknown
): value is AsciiCanvasDocumentV1 => {
  if (!isObject(value)) return false;
  if (value.type !== ASCII_CANVAS_DOCUMENT_TYPE) return false;
  if (value.version !== ASCII_CANVAS_DOCUMENT_VERSION) return false;

  if (value.mode === "freeform") {
    return Array.isArray(value.cells) && value.cells.every(isProtocolCell);
  }

  if (value.mode === "animation") {
    return (
      isObject(value.size) &&
      typeof value.size.width === "number" &&
      Number.isFinite(value.size.width) &&
      typeof value.size.height === "number" &&
      Number.isFinite(value.size.height) &&
      isObject(value.playback) &&
      typeof value.playback.fps === "number" &&
      Number.isFinite(value.playback.fps) &&
      typeof value.playback.loop === "boolean" &&
      Array.isArray(value.frames) &&
      value.frames.every(
        (frame) =>
          isObject(frame) &&
          typeof frame.id === "string" &&
          typeof frame.name === "string" &&
          Array.isArray(frame.cells) &&
          frame.cells.every(isProtocolCell)
      )
    );
  }

  if (value.mode === "structured") {
    return Array.isArray(value.nodes) && value.nodes.every(isStructuredNode);
  }

  return false;
};

export const isAsciiCanvasDocumentVersion = (
  value: unknown,
  version = ASCII_CANVAS_DOCUMENT_VERSION
) => {
  return isObject(value) && value.version === version;
};
