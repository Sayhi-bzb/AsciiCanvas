import { Awareness } from "y-protocols/awareness";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebrtcProvider } from "y-webrtc";
import { WebsocketProvider } from "y-websocket";
import type * as Y from "yjs";
import {
  ensureCollaborationDocumentMeta,
  getCollaborationPersistenceName,
  getCollaborationRoomName,
} from "./document";
import {
  buildCollaborationPresence,
  readCollaborationPeers,
  type CollaborationAwareness,
} from "./presence";
import { sameCollaborationRoom } from "./room-link";
import type {
  CollaborationDescriptorV2,
  CollaborationIntegrityIssue,
  CollaborationSnapshot,
} from "./model";

type Listener = () => void;

type PersistenceAdapter = {
  whenSynced: Promise<unknown>;
  destroy: () => Promise<unknown> | void;
  clearData: () => Promise<unknown>;
};

type NetworkProviderAdapter = {
  on: (event: string, callback: (event: unknown) => void) => void;
  destroy: () => void;
};

type CollaborationRuntimeDependencies = {
  createPersistence: (descriptor: CollaborationDescriptorV2, doc: Y.Doc) => Promise<PersistenceAdapter>;
  createAwareness: (doc: Y.Doc) => CollaborationAwareness;
  createProvider: (
    descriptor: CollaborationDescriptorV2,
    doc: Y.Doc,
    awareness: CollaborationAwareness
  ) => NetworkProviderAdapter;
};

const DEFAULT_DEPENDENCIES: CollaborationRuntimeDependencies = {
  createPersistence: async (descriptor, doc) =>
    new IndexeddbPersistence(await getCollaborationPersistenceName(descriptor), doc),
  createAwareness: (doc) => new Awareness(doc) as unknown as CollaborationAwareness,
  createProvider: (descriptor, doc, awareness) =>
    (descriptor.provider === "p2p"
      ? new WebrtcProvider(getCollaborationRoomName(descriptor), doc, {
          password: descriptor.key,
          awareness: awareness as unknown as Awareness,
          maxConns: 8,
        })
      : new WebsocketProvider(descriptor.endpoint, getCollaborationRoomName(descriptor), doc, {
          awareness: awareness as unknown as Awareness,
        })) as unknown as NetworkProviderAdapter,
};

const MAX_INTEGRITY_ISSUES = 50;

const EMPTY_SNAPSHOT: CollaborationSnapshot = {
  descriptor: null,
  documentStatus: "idle",
  connectionStatus: "idle",
  canEdit: true,
  peers: [],
  error: null,
  errorKind: null,
  hasLocalCopy: false,
  integrityIssues: [],
};

export { ensureCollaborationDocumentMeta, getCollaborationPersistenceName } from "./document";

class CollaborationSession {
  private provider: NetworkProviderAdapter | null = null;
  private persistence: PersistenceAdapter | null = null;
  private awareness: CollaborationAwareness | null = null;
  private metaObserver: (() => void) | null = null;
  private peerCount = 0;
  private disposed = false;
  readonly descriptor: CollaborationDescriptorV2;
  private readonly doc: Y.Doc;
  private readonly publish: (patch: Partial<CollaborationSnapshot>) => void;
  private readonly dependencies: CollaborationRuntimeDependencies;

  constructor(
    descriptor: CollaborationDescriptorV2,
    doc: Y.Doc,
    publish: (patch: Partial<CollaborationSnapshot>) => void,
    dependencies: CollaborationRuntimeDependencies
  ) {
    this.descriptor = descriptor;
    this.doc = doc;
    this.publish = publish;
    this.dependencies = dependencies;
  }

  async start() {
    let documentReady = false;
    try {
      const persistence = await this.dependencies.createPersistence(this.descriptor, this.doc);
      if (this.disposed) {
        await persistence.destroy();
        return;
      }
      this.persistence = persistence;
      await persistence.whenSynced;
      if (this.disposed) return;

      const hasLocalCopy =
        this.doc.getMap("main-grid").size > 0 ||
        this.doc.getMap("structured-scene").size > 0 ||
        this.doc.getMap("structured-components").size > 0;
      ensureCollaborationDocumentMeta(this.descriptor, this.doc);
      const meta = this.doc.getMap<unknown>("document-meta");
      this.metaObserver = () => {
        if (this.disposed) return;
        try {
          ensureCollaborationDocumentMeta(this.descriptor, this.doc);
        } catch (error) {
          this.publish({
            documentStatus: "incompatible",
            canEdit: false,
            errorKind: "incompatible-document",
            error: error instanceof Error ? error.message : "Incompatible collaboration document",
          });
        }
      };
      meta.observe(this.metaObserver);

      const awareness = this.dependencies.createAwareness(this.doc);
      this.awareness = awareness;
      awareness.setLocalState(buildCollaborationPresence(this.descriptor));
      awareness.on("change", () => {
        if (this.disposed) return;
        const { peers, issues } = readCollaborationPeers(awareness, this.descriptor.mode);
        this.publish({ peers, integrityIssues: issues.slice(0, MAX_INTEGRITY_ISSUES) });
      });

      this.publish({
        documentStatus: "ready",
        connectionStatus: "connecting",
        canEdit: true,
        hasLocalCopy,
      });
      documentReady = true;
      this.connectProvider(awareness);
    } catch (error) {
      if (this.disposed) return;
      const incompatible =
        error instanceof Error && error.message === "Incompatible collaboration document";
      const providerFailure = documentReady && !incompatible;
      this.publish({
        documentStatus: incompatible ? "incompatible" : providerFailure ? "ready" : "error",
        connectionStatus: "offline",
        canEdit: providerFailure,
        errorKind: incompatible
          ? "incompatible-document"
          : providerFailure
            ? "provider"
            : "persistence",
        error: error instanceof Error ? error.message : "Collaboration failed",
      });
    }
  }

  private connectProvider(awareness: CollaborationAwareness) {
    const provider = this.dependencies.createProvider(this.descriptor, this.doc, awareness);
    this.provider = provider;
    if (this.descriptor.provider === "p2p") {
      provider.on("peers", (event) => {
        if (this.disposed) return;
        const { webrtcPeers, bcPeers } = event as { webrtcPeers: string[]; bcPeers: string[] };
        this.peerCount = webrtcPeers.length + bcPeers.length;
        this.publish({
          connectionStatus: this.peerCount > 0 ? "online" : "waiting-for-peer",
        });
      });
      provider.on("status", (event) => {
        if (this.disposed) return;
        const { connected } = event as { connected: boolean };
        this.publish({
          connectionStatus: connected
            ? this.peerCount > 0 ? "online" : "waiting-for-peer"
            : "offline",
        });
      });
      return;
    }

    provider.on("status", (event) => {
      if (this.disposed) return;
      const { status } = event as { status: "connected" | "disconnected" | "connecting" };
      this.publish({
        connectionStatus:
          status === "connected" ? "online" : status === "connecting" ? "connecting" : "offline",
      });
    });
    provider.on("connection-error", () => {
      if (this.disposed) return;
      this.publish({
        connectionStatus: "offline",
        errorKind: "provider",
        error: "Connection failed",
      });
    });
    provider.on("sync", (event) => {
      const isSynced = event as boolean;
      if (this.disposed || !isSynced) return;
      try {
        ensureCollaborationDocumentMeta(this.descriptor, this.doc);
      } catch (error) {
        this.publish({
          documentStatus: "incompatible",
          canEdit: false,
          errorKind: "incompatible-document",
          error: error instanceof Error ? error.message : "Incompatible collaboration document",
        });
      }
    });
  }

  setPresence(input: { cursor?: { x: number; y: number } | null; selection?: unknown; tool?: string }) {
    if (!this.awareness) return;
    this.awareness.setLocalState(buildCollaborationPresence(this.descriptor, input));
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.provider?.destroy();
    this.provider = null;
    this.awareness?.destroy();
    this.awareness = null;
    if (this.metaObserver) this.doc.getMap("document-meta").unobserve(this.metaObserver);
    this.metaObserver = null;
    if (this.persistence) await this.persistence.destroy();
    this.persistence = null;
  }

  async clearPersistence() {
    await this.persistence?.clearData();
  }
}

export class CollaborationRuntime {
  private snapshot = EMPTY_SNAPSHOT;
  private listeners = new Set<Listener>();
  private session: CollaborationSession | null = null;
  private generation = 0;
  private readonly dependencies: CollaborationRuntimeDependencies;

  constructor(dependencies: Partial<CollaborationRuntimeDependencies> = {}) {
    this.dependencies = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  }

  getSnapshot = () => this.snapshot;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(patch: Partial<CollaborationSnapshot>) {
    if (
      patch.connectionStatus === "online" &&
      this.snapshot.errorKind === "provider"
    ) {
      patch.error = null;
      patch.errorKind = null;
    }
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  async connect(descriptor: CollaborationDescriptorV2, doc: Y.Doc) {
    const generation = ++this.generation;
    const previousSession = this.session;
    this.session = null;
    await previousSession?.dispose();
    if (this.generation !== generation) return;
    this.publish({
      ...EMPTY_SNAPSHOT,
      descriptor,
      documentStatus: "restoring",
      connectionStatus: "idle",
      canEdit: false,
    });
    const session = new CollaborationSession(descriptor, doc, (patch) => {
      if (this.generation !== generation || this.session !== session) return;
      if (patch.integrityIssues) {
        const documentIssues = this.snapshot.integrityIssues.filter(
          (issue) => issue.channel !== "presence"
        );
        patch.integrityIssues = [...documentIssues, ...patch.integrityIssues].slice(
          0,
          MAX_INTEGRITY_ISSUES
        );
      }
      this.publish(patch);
    }, this.dependencies);
    this.session = session;
    await session.start();
  }

  setPresence(presence: { cursor?: { x: number; y: number } | null; selection?: unknown; tool?: string }) {
    this.session?.setPresence(presence);
  }

  reportIntegrityIssues(issues: CollaborationIntegrityIssue[]) {
    if (!this.session) return;
    const presenceIssues = this.snapshot.integrityIssues.filter(
      (issue) => issue.channel === "presence"
    );
    this.publish({
      integrityIssues: [...issues, ...presenceIssues].slice(0, MAX_INTEGRITY_ISSUES),
    });
  }

  async disconnect() {
    const generation = ++this.generation;
    const session = this.session;
    this.session = null;
    await session?.dispose();
    if (this.generation === generation) this.publish(EMPTY_SNAPSHOT);
  }

  async forget(descriptor: CollaborationDescriptorV2) {
    const isActive = sameCollaborationRoom(this.snapshot.descriptor ?? undefined, descriptor);
    if (isActive && this.session) {
      await this.session.clearPersistence();
      return;
    }
    const temporaryDoc = new (await import("yjs")).Doc();
    const persistence = await this.dependencies.createPersistence(descriptor, temporaryDoc);
    await persistence.whenSynced;
    await persistence.clearData();
    await persistence.destroy();
    temporaryDoc.destroy();
  }
}

export const collaborationRuntime = new CollaborationRuntime();
