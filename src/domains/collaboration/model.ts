export type CollaborationProviderKind = "p2p" | "websocket";

export type CollaborationDescriptorV1 =
  | {
      version: 1;
      provider: "p2p";
      roomId: string;
      key: string;
    }
  | {
      version: 1;
      provider: "websocket";
      roomId: string;
      key: string;
      endpoint: string;
    };

export type CollaborationStatus =
  | "idle"
  | "loading-local"
  | "connecting"
  | "waiting-for-peer"
  | "connected"
  | "offline"
  | "error";

export type CollaborationPeer = {
  clientId: number;
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number } | null;
  selection?: unknown;
};

export type CollaborationSnapshot = {
  descriptor: CollaborationDescriptorV1 | null;
  status: CollaborationStatus;
  peers: CollaborationPeer[];
  error: string | null;
  hasLocalCopy: boolean;
};

