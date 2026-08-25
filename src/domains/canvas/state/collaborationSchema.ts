import type { CollaborationIntegrityIssue } from "@/domains/collaboration/public";
import type { StructuredComponentInstance, StructuredNode } from "@/domains/structured-content/public";
import { toStructuredNode } from "./helpers/snapshotHelpers";

export const CANVAS_COLLABORATION_CHANNELS = {
  meta: { name: "document-meta", scope: "document" },
  content: { name: "cell-plane-operations", scope: "document" },
  scene: { name: "structured-scene", scope: "document" },
  components: { name: "structured-components", scope: "document" },
  presence: { name: "presence", scope: "presence" },
} as const;

type CanvasDocumentChannel = CollaborationIntegrityIssue["channel"];

type CollaborationDecodeResult<T> =
  | { ok: true; value: T }
  | { ok: false; issue: CollaborationIntegrityIssue };

const invalid = <T>(channel: CanvasDocumentChannel, key: string, reason: string): CollaborationDecodeResult<T> => ({
  ok: false,
  issue: { channel, key, reason },
});

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
