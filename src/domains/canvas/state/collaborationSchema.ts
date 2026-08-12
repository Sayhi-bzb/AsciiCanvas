import type { CollaborationIntegrityIssue } from "@/domains/collaboration/public";
import type { StructuredComponentInstance, StructuredNode } from "@/domains/structured-content/public";
import type { GridCell } from "@/shared/types";
import { normalizeGridEntries, toStructuredNode } from "./helpers/snapshotHelpers";

export const CANVAS_COLLABORATION_CHANNELS = {
  meta: { name: "document-meta", scope: "document" },
  grid: { name: "main-grid", scope: "document" },
  scene: { name: "structured-scene", scope: "document" },
  components: { name: "structured-components", scope: "document" },
  presence: { name: "presence", scope: "presence" },
} as const;

type CanvasDocumentChannel = CollaborationIntegrityIssue["channel"];

export type CollaborationDecodeResult<T> =
  | { ok: true; value: T }
  | { ok: false; issue: CollaborationIntegrityIssue };

const invalid = <T>(channel: CanvasDocumentChannel, key: string, reason: string): CollaborationDecodeResult<T> => ({
  ok: false,
  issue: { channel, key, reason },
});

export const decodeCollaborativeGridCell = (
  key: string,
  value: unknown
): CollaborationDecodeResult<GridCell> => {
  try {
    const coordinates = key.split(",");
    if (
      coordinates.length !== 2 ||
      coordinates.some((coordinate) => {
        if (!/^-?\d+$/.test(coordinate)) return true;
        return !Number.isSafeInteger(Number(coordinate));
      })
    ) {
      return invalid("main-grid", key, "Invalid grid coordinate key");
    }
    const normalized = normalizeGridEntries([[key, value]]);
    return normalized.length === 1
      ? { ok: true, value: normalized[0][1] }
      : invalid("main-grid", key, "Invalid grid cell");
  } catch {
    return invalid("main-grid", key, "Invalid grid cell");
  }
};

export const decodeCollaborativeStructuredNode = (
  key: string,
  value: unknown
): CollaborationDecodeResult<StructuredNode> => {
  try {
    const node = toStructuredNode(value);
    if (!node) return invalid("structured-scene", key, "Invalid structured node");
    if (node.id !== key) {
      return invalid("structured-scene", key, "Node id does not match its record key");
    }
    return { ok: true, value: node };
  } catch {
    return invalid("structured-scene", key, "Invalid structured node");
  }
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

export const decodeCollaborativeStructuredComponent = (
  key: string,
  value: unknown
): CollaborationDecodeResult<StructuredComponentInstance> => {
  try {
    if (!value || typeof value !== "object") {
      return invalid("structured-components", key, "Invalid structured component");
    }
    const component = value as Partial<StructuredComponentInstance>;
    if (
      component.id !== key ||
      typeof component.templateId !== "string" ||
      typeof component.label !== "string" ||
      !isStringArray(component.atomIds) ||
      !component.roles ||
      typeof component.roles !== "object" ||
      !Object.values(component.roles).every(isStringArray)
    ) {
      return invalid("structured-components", key, "Invalid structured component");
    }
    return {
      ok: true,
      value: {
        id: key,
        templateId: component.templateId,
        label: component.label,
        atomIds: [...component.atomIds],
        roles: Object.fromEntries(
          Object.entries(component.roles).map(([role, ids]) => [role, [...ids]])
        ),
      },
    };
  } catch {
    return invalid("structured-components", key, "Invalid structured component");
  }
};
