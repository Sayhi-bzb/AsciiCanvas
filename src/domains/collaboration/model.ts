export type CollaborationProviderKind = "p2p" | "websocket";

export const COLLABORATION_DOCUMENT_VERSION = 2 as const;

export type CollaborationCanvasMode = "freeform" | "structured";

export type CollaborationDescriptorV2 =
  | {
      version: 2;
      documentVersion: typeof COLLABORATION_DOCUMENT_VERSION;
      mode: CollaborationCanvasMode;
      provider: "p2p";
      roomId: string;
      key: string;
    }
  | {
      version: 2;
      documentVersion: typeof COLLABORATION_DOCUMENT_VERSION;
      mode: CollaborationCanvasMode;
      provider: "websocket";
      roomId: string;
      key: string;
      endpoint: string;
    };

export type CollaborationLinkParseResult =
  | { status: "none" }
  | { status: "valid"; descriptor: CollaborationDescriptorV2 }
  | { status: "unsupported"; version: number | null }
  | { status: "invalid" };

export type CollaborationDocumentStatus =
  | "idle"
  | "restoring"
  | "ready"
  | "incompatible"
  | "error";

export type CollaborationConnectionStatus =
  | "idle"
  | "connecting"
  | "waiting-for-peer"
  | "online"
  | "offline";

export type CollaborationErrorKind =
  | "persistence"
  | "incompatible-document"
  | "provider"
  | "invalid-remote-data";

export type CollaborationIntegrityIssue = {
  channel: "main-grid" | "structured-scene" | "structured-components" | "presence";
  key: string;
  reason: string;
};

export type CollaborationPresenceSelection =
  | {
      mode: "freeform";
      areas: Array<{
        start: { x: number; y: number };
        end: { x: number; y: number };
      }>;
    }
  | { mode: "structured"; nodeIds: string[] };

export type CollaborationPresenceV1 = {
  version: 1;
  mode: CollaborationCanvasMode;
  user: {
    id: string;
    name: string;
    color: string;
  };
  cursor?: { x: number; y: number } | null;
  selection?: CollaborationPresenceSelection;
  tool?: string;
};

export type CollaborationPeer = {
  clientId: number;
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number } | null;
  selection?: CollaborationPresenceSelection;
};

export type CollaborationSnapshot = {
  descriptor: CollaborationDescriptorV2 | null;
  documentStatus: CollaborationDocumentStatus;
  connectionStatus: CollaborationConnectionStatus;
  canEdit: boolean;
  peers: CollaborationPeer[];
  error: string | null;
  errorKind: CollaborationErrorKind | null;
  hasLocalCopy: boolean;
  integrityIssues: CollaborationIntegrityIssue[];
};
