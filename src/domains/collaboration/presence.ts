import { getCollaborationIdentity } from "./identity";
import type {
  CollaborationDescriptorV2,
  CollaborationIntegrityIssue,
  CollaborationPeer,
  CollaborationPresenceSelection,
  CollaborationPresenceV1,
} from "./model";

export type CollaborationAwareness = {
  clientID: number;
  getStates: () => Map<number, Record<string, unknown>>;
  setLocalState: (state: Record<string, unknown> | null) => void;
  on: (event: "change", callback: () => void) => void;
  destroy: () => void;
};

const isPoint = (value: unknown): value is { x: number; y: number } => {
  if (!value || typeof value !== "object") return false;
  const point = value as { x?: unknown; y?: unknown };
  return Number.isFinite(point.x) && Number.isFinite(point.y);
};

const decodeSelection = (
  value: unknown,
  mode: CollaborationDescriptorV2["mode"]
): CollaborationPresenceSelection | undefined => {
  if (!value) return undefined;
  if (value && typeof value === "object" && "mode" in value) {
    const selection = value as Partial<CollaborationPresenceSelection>;
    if (selection.mode === "structured" && Array.isArray(selection.nodeIds)) {
      const nodeIds = selection.nodeIds.filter((id): id is string => typeof id === "string");
      return nodeIds.length === selection.nodeIds.length
        ? { mode: "structured", nodeIds }
        : undefined;
    }
    if (selection.mode === "freeform" && Array.isArray(selection.areas)) {
      const areas = selection.areas.filter(
        (area): area is { start: { x: number; y: number }; end: { x: number; y: number } } =>
          !!area && typeof area === "object" &&
          isPoint((area as { start?: unknown }).start) &&
          isPoint((area as { end?: unknown }).end)
      );
      return areas.length === selection.areas.length ? { mode: "freeform", areas } : undefined;
    }
    return undefined;
  }
  if (!Array.isArray(value)) return undefined;
  if (mode === "structured" && value.every((id) => typeof id === "string")) {
    return { mode, nodeIds: value };
  }
  if (
    mode === "freeform" &&
    value.every((area) =>
      !!area && typeof area === "object" &&
      isPoint((area as { start?: unknown }).start) &&
      isPoint((area as { end?: unknown }).end)
    )
  ) {
    return { mode, areas: value } as CollaborationPresenceSelection;
  }
  return undefined;
};

const decodePresence = (
  state: Record<string, unknown>,
  mode: CollaborationDescriptorV2["mode"]
): Omit<CollaborationPresenceV1, "version" | "mode"> | null => {
  const user = state.user;
  if (!user || typeof user !== "object") return null;
  const candidate = user as { id?: unknown; name?: unknown; color?: unknown };
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.color !== "string"
  ) return null;
  const cursor = state.cursor == null ? null : isPoint(state.cursor) ? state.cursor : undefined;
  const selection = decodeSelection(state.selection, mode);
  return {
    user: { id: candidate.id, name: candidate.name, color: candidate.color },
    ...(cursor !== undefined ? { cursor } : {}),
    ...(selection ? { selection } : {}),
    ...(typeof state.tool === "string" ? { tool: state.tool } : {}),
  };
};

export const readCollaborationPeers = (
  awareness: CollaborationAwareness,
  mode: CollaborationDescriptorV2["mode"]
): { peers: CollaborationPeer[]; issues: CollaborationIntegrityIssue[] } => {
  const peers: CollaborationPeer[] = [];
  const issues: CollaborationIntegrityIssue[] = [];
  awareness.getStates().forEach((state, clientId) => {
    if (clientId === awareness.clientID) return;
    const presence = decodePresence(state, mode);
    if (!presence) {
      issues.push({ channel: "presence", key: String(clientId), reason: "Invalid presence" });
      return;
    }
    peers.push({
      clientId,
      id: presence.user.id,
      name: presence.user.name,
      color: presence.user.color,
      cursor: presence.cursor ?? null,
      selection: presence.selection,
    });
  });
  peers.sort((a, b) => a.clientId - b.clientId);
  return { peers, issues };
};

export const buildCollaborationPresence = (
  descriptor: CollaborationDescriptorV2,
  input: { cursor?: { x: number; y: number } | null; selection?: unknown; tool?: string } = {}
): CollaborationPresenceV1 => {
  const selection = decodeSelection(input.selection, descriptor.mode);
  return {
    version: 1,
    mode: descriptor.mode,
    user: getCollaborationIdentity(),
    ...(input.cursor === null || isPoint(input.cursor) ? { cursor: input.cursor } : {}),
    ...(selection ? { selection } : {}),
    ...(typeof input.tool === "string" ? { tool: input.tool } : {}),
  };
};
