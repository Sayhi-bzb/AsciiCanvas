import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import type { CollaborationDescriptorV2 } from "./model";
import {
  CollaborationRuntime,
  ensureCollaborationDocumentMeta,
  getCollaborationPersistenceName,
} from "./runtime";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => { resolve = next; });
  return { promise, resolve };
};

const createRuntimeHarness = () => {
  const sync = deferred();
  const persistence = {
    whenSynced: sync.promise,
    destroy: vi.fn(),
    clearData: vi.fn(async () => {}),
  };
  const states = new Map<number, Record<string, unknown>>();
  const awareness = {
    clientID: 1,
    getStates: () => states,
    setLocalState: vi.fn((state: Record<string, unknown> | null) => {
      if (state) states.set(1, state);
      else states.delete(1);
    }),
    on: vi.fn(),
    destroy: vi.fn(),
  };
  const providerListeners = new Map<string, (event: unknown) => void>();
  const provider = {
    on: vi.fn((event: string, listener: (event: unknown) => void) => {
      providerListeners.set(event, listener);
    }),
    destroy: vi.fn(),
  };
  const runtime = new CollaborationRuntime({
    createPersistence: vi.fn(async () => persistence),
    createAwareness: vi.fn(() => awareness),
    createProvider: vi.fn(() => provider),
  });
  return { runtime, sync, persistence, awareness, provider, providerListeners };
};

const descriptor = (
  endpoint: string,
  key = "room-key-1234567890123456789012345678901234567890"
): CollaborationDescriptorV2 => ({
  version: 2,
  documentVersion: 2,
  mode: "freeform",
  provider: "websocket",
  roomId: "room-id-1234567890",
  key,
  endpoint,
});

describe("collaboration document contract", () => {
  it("isolates local room caches by endpoint and key without exposing the key", async () => {
    const first = await getCollaborationPersistenceName(
      descriptor("wss://one.example.com")
    );
    const otherEndpoint = await getCollaborationPersistenceName(
      descriptor("wss://two.example.com")
    );
    const otherKey = await getCollaborationPersistenceName(
      descriptor(
        "wss://one.example.com",
        "other-key-123456789012345678901234567890123456789"
      )
    );

    expect(first).not.toBe(otherEndpoint);
    expect(first).not.toBe(otherKey);
    expect(first).not.toContain("room-key");
  });

  it("initializes immutable room metadata and rejects a mode mismatch", () => {
    const doc = new Y.Doc();
    const freeform = descriptor("wss://one.example.com");
    ensureCollaborationDocumentMeta(freeform, doc);

    expect(doc.getMap("document-meta").toJSON()).toEqual({
      documentVersion: 2,
      mode: "freeform",
      roomId: freeform.roomId,
    });
    expect(() =>
      ensureCollaborationDocumentMeta({ ...freeform, mode: "structured" }, doc)
    ).toThrow("Incompatible collaboration document");

    doc.getMap("document-meta").set("documentVersion", 99);
    expect(() => ensureCollaborationDocumentMeta(freeform, doc)).toThrow(
      "Incompatible collaboration document"
    );
  });

  it("keeps document readiness separate from network connection state", async () => {
    const harness = createRuntimeHarness();
    const doc = new Y.Doc();
    const connect = harness.runtime.connect(descriptor("wss://one.example.com"), doc);
    await vi.waitFor(() => {
      expect(harness.runtime.getSnapshot()).toMatchObject({
        documentStatus: "restoring",
        connectionStatus: "idle",
        canEdit: false,
      });
    });

    harness.sync.resolve();
    await connect;
    expect(harness.runtime.getSnapshot()).toMatchObject({
      documentStatus: "ready",
      connectionStatus: "connecting",
      canEdit: true,
    });

    harness.providerListeners.get("status")?.({ status: "connected" });
    expect(harness.runtime.getSnapshot().connectionStatus).toBe("online");
  });

  it("destroys every session-owned resource and ignores stale provider events", async () => {
    const harness = createRuntimeHarness();
    const connect = harness.runtime.connect(descriptor("wss://one.example.com"), new Y.Doc());
    harness.sync.resolve();
    await connect;
    const statusListener = harness.providerListeners.get("status");

    await harness.runtime.disconnect();
    expect(harness.provider.destroy).toHaveBeenCalledOnce();
    expect(harness.awareness.destroy).toHaveBeenCalledOnce();
    expect(harness.persistence.destroy).toHaveBeenCalledOnce();
    expect(harness.runtime.getSnapshot()).toMatchObject({
      descriptor: null,
      documentStatus: "idle",
      canEdit: true,
    });

    statusListener?.({ status: "connected" });
    expect(harness.runtime.getSnapshot().connectionStatus).toBe("idle");
  });

  it("keeps the newest room active when connects overlap", async () => {
    const firstSync = deferred();
    const secondSync = deferred();
    const provider = { on: vi.fn(), destroy: vi.fn() };
    const runtime = new CollaborationRuntime({
      createPersistence: vi.fn(async (room) => ({
        whenSynced: room.roomId === "room-a" ? firstSync.promise : secondSync.promise,
        destroy: vi.fn(),
        clearData: vi.fn(async () => {}),
      })),
      createAwareness: vi.fn(() => ({
        clientID: 1,
        getStates: () => new Map(),
        setLocalState: vi.fn(),
        on: vi.fn(),
        destroy: vi.fn(),
      })),
      createProvider: vi.fn(() => provider),
    });
    const firstDescriptor = { ...descriptor("wss://one.example.com"), roomId: "room-a" };
    const secondDescriptor = { ...descriptor("wss://one.example.com"), roomId: "room-b" };

    const firstConnect = runtime.connect(firstDescriptor, new Y.Doc());
    await vi.waitFor(() => expect(runtime.getSnapshot().descriptor?.roomId).toBe("room-a"));
    const secondConnect = runtime.connect(secondDescriptor, new Y.Doc());
    await vi.waitFor(() => expect(runtime.getSnapshot().descriptor?.roomId).toBe("room-b"));

    secondSync.resolve();
    await secondConnect;
    firstSync.resolve();
    await firstConnect;

    expect(runtime.getSnapshot()).toMatchObject({
      descriptor: { roomId: "room-b" },
      documentStatus: "ready",
      canEdit: true,
    });
  });

  it("preserves presence issues when canvas integrity issues are reported", async () => {
    const harness = createRuntimeHarness();
    const connect = harness.runtime.connect(descriptor("wss://one.example.com"), new Y.Doc());
    harness.sync.resolve();
    await connect;

    harness.awareness.getStates().set(2, { user: { id: 2 } });
    const changeListener = harness.awareness.on.mock.calls.find(([event]) => event === "change")?.[1];
    changeListener?.();
    harness.runtime.reportIntegrityIssues([
      { channel: "main-grid", key: "0,0", reason: "Invalid grid cell" },
    ]);

    expect(harness.runtime.getSnapshot().integrityIssues).toEqual([
      { channel: "main-grid", key: "0,0", reason: "Invalid grid cell" },
      { channel: "presence", key: "2", reason: "Invalid presence" },
    ]);
  });

  it("keeps a restored document editable when provider creation fails", async () => {
    const harness = createRuntimeHarness();
    const runtime = new CollaborationRuntime({
      createPersistence: vi.fn(async () => harness.persistence),
      createAwareness: vi.fn(() => harness.awareness),
      createProvider: vi.fn(() => { throw new Error("Provider unavailable"); }),
    });
    const connect = runtime.connect(descriptor("wss://one.example.com"), new Y.Doc());
    harness.sync.resolve();
    await connect;

    expect(runtime.getSnapshot()).toMatchObject({
      documentStatus: "ready",
      connectionStatus: "offline",
      canEdit: true,
      errorKind: "provider",
      error: "Provider unavailable",
    });
  });
});
