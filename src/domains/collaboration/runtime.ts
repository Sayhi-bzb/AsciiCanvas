import { Awareness } from "y-protocols/awareness";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebrtcProvider } from "y-webrtc";
import { WebsocketProvider } from "y-websocket";
import type * as Y from "yjs";
import { getCollaborationIdentity } from "./identity";
import type {
  CollaborationDescriptorV1,
  CollaborationPeer,
  CollaborationSnapshot,
  CollaborationStatus,
} from "./model";

type NetworkProvider = WebrtcProvider | WebsocketProvider;
type Listener = () => void;

const EMPTY_SNAPSHOT: CollaborationSnapshot = {
  descriptor: null,
  status: "idle",
  peers: [],
  error: null,
  hasLocalCopy: false,
};

const persistenceName = (descriptor: CollaborationDescriptorV1) =>
  `ascii-canvas-room-v1:${descriptor.provider}:${descriptor.roomId}`;

const roomName = (descriptor: CollaborationDescriptorV1) =>
  descriptor.provider === "p2p"
    ? `asciicanvas-v1-${descriptor.roomId}`
    : `asciicanvas-v1-${descriptor.roomId}-${descriptor.key}`;

const toPeers = (awareness: Awareness): CollaborationPeer[] => {
  const peers: CollaborationPeer[] = [];
  awareness.getStates().forEach((state, clientId) => {
    if (clientId === awareness.clientID || !state.user) return;
    const user = state.user as Partial<CollaborationPeer>;
    if (!user.id || !user.name || !user.color) return;
    peers.push({
      clientId,
      id: user.id,
      name: user.name,
      color: user.color,
      cursor: state.cursor ?? null,
      selection: state.selection,
    });
  });
  return peers.sort((a, b) => a.clientId - b.clientId);
};

export class CollaborationRuntime {
  private snapshot = EMPTY_SNAPSHOT;
  private listeners = new Set<Listener>();
  private provider: NetworkProvider | null = null;
  private persistence: IndexeddbPersistence | null = null;
  private awareness: Awareness | null = null;
  private generation = 0;
  private peerCount = 0;

  getSnapshot = () => this.snapshot;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(patch: Partial<CollaborationSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  async connect(descriptor: CollaborationDescriptorV1, doc: Y.Doc) {
    await this.disconnect();
    const generation = ++this.generation;
    this.publish({ descriptor, status: "loading-local", peers: [], error: null, hasLocalCopy: false });

    try {
      const persistence = new IndexeddbPersistence(persistenceName(descriptor), doc);
      this.persistence = persistence;
      await persistence.whenSynced;
      if (generation !== this.generation) return;

      const hasLocalCopy = doc.getMap("main-grid").size > 0 || doc.getMap("structured-scene").size > 0 || doc.getMap("structured-components").size > 0;
      const awareness = new Awareness(doc);
      this.awareness = awareness;
      awareness.setLocalStateField("user", getCollaborationIdentity());
      awareness.on("change", () => {
        if (generation !== this.generation) return;
        this.publish({ peers: toPeers(awareness) });
      });
      this.publish({ status: "connecting", hasLocalCopy });

      if (descriptor.provider === "p2p") {
        const provider = new WebrtcProvider(roomName(descriptor), doc, {
          password: descriptor.key,
          awareness,
          maxConns: 8,
        });
        this.provider = provider;
        provider.on("peers", ({ webrtcPeers, bcPeers }: { webrtcPeers: string[]; bcPeers: string[] }) => {
          if (generation !== this.generation) return;
          this.peerCount = webrtcPeers.length + bcPeers.length;
          this.publish({ status: this.peerCount > 0 ? "connected" : "waiting-for-peer" });
        });
        provider.on("status", ({ connected }: { connected: boolean }) => {
          if (generation !== this.generation) return;
          this.publish({ status: connected ? (this.peerCount > 0 ? "connected" : "waiting-for-peer") : "offline" });
        });
      } else {
        const provider = new WebsocketProvider(
          descriptor.endpoint,
          roomName(descriptor),
          doc,
          { awareness }
        );
        this.provider = provider;
        provider.on("status", ({ status }: { status: "connected" | "disconnected" | "connecting" }) => {
          if (generation !== this.generation) return;
          const nextStatus: CollaborationStatus = status === "connected" ? "connected" : status === "connecting" ? "connecting" : "offline";
          this.publish({ status: nextStatus });
        });
        provider.on("connection-error", () => {
          if (generation === this.generation) this.publish({ status: "error", error: "Connection failed" });
        });
      }
    } catch (error) {
      if (generation === this.generation) {
        this.publish({ status: "error", error: error instanceof Error ? error.message : "Collaboration failed" });
      }
    }
  }

  setPresence(presence: { cursor?: { x: number; y: number } | null; selection?: unknown; tool?: string }) {
    if (!this.awareness) return;
    Object.entries(presence).forEach(([key, value]) => this.awareness?.setLocalStateField(key, value));
  }

  async disconnect() {
    this.generation += 1;
    this.peerCount = 0;
    this.provider?.destroy();
    this.provider = null;
    this.awareness?.destroy();
    this.awareness = null;
    if (this.persistence) await this.persistence.destroy();
    this.persistence = null;
    this.publish(EMPTY_SNAPSHOT);
  }

  async forget(descriptor: CollaborationDescriptorV1) {
    const isActive = this.snapshot.descriptor?.roomId === descriptor.roomId;
    if (isActive && this.persistence) {
      await this.persistence.clearData();
      return;
    }
    const temporaryDoc = new (await import("yjs")).Doc();
    const persistence = new IndexeddbPersistence(persistenceName(descriptor), temporaryDoc);
    await persistence.whenSynced;
    await persistence.clearData();
    temporaryDoc.destroy();
  }
}

export const collaborationRuntime = new CollaborationRuntime();
