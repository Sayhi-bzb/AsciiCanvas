import type * as Y from "yjs";
import type { CollaborationDescriptorV2 } from "./model";

const toBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

export const getCollaborationPersistenceName = async (
  descriptor: CollaborationDescriptorV2
) => {
  const identity = JSON.stringify({
    provider: descriptor.provider,
    endpoint: descriptor.provider === "websocket" ? descriptor.endpoint : null,
    roomId: descriptor.roomId,
    key: descriptor.key,
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(identity)
  );
  return `ascii-canvas-room-v2:${toBase64Url(new Uint8Array(digest))}`;
};

export const getCollaborationRoomName = (descriptor: CollaborationDescriptorV2) =>
  descriptor.provider === "p2p"
    ? `asciicanvas-v2-${descriptor.roomId}`
    : `asciicanvas-v2-${descriptor.roomId}-${descriptor.key}`;

type CollaborationDocumentMigration = {
  id: string;
  from: number;
  to: number;
  migrate: (doc: Y.Doc) => void;
};

// V2 is the migration baseline. Future migrations are appended with stable ids.
const DOCUMENT_MIGRATIONS: ReadonlyArray<CollaborationDocumentMigration> = [];

export const ensureCollaborationDocumentMeta = (
  descriptor: CollaborationDescriptorV2,
  doc: Y.Doc
) => {
  const meta = doc.getMap<unknown>("document-meta");
  if (meta.size === 0) {
    doc.transact(() => {
      meta.set("documentVersion", descriptor.documentVersion);
      meta.set("mode", descriptor.mode);
      meta.set("roomId", descriptor.roomId);
    }, "collaboration-meta");
    return;
  }
  if (meta.get("mode") !== descriptor.mode || meta.get("roomId") !== descriptor.roomId) {
    throw new Error("Incompatible collaboration document");
  }
  const version = meta.get("documentVersion");
  if (version === descriptor.documentVersion) return;
  if (typeof version !== "number" || version > descriptor.documentVersion) {
    throw new Error("Incompatible collaboration document");
  }
  let nextVersion = version;
  while (nextVersion < descriptor.documentVersion) {
    const migration = DOCUMENT_MIGRATIONS.find((candidate) => candidate.from === nextVersion);
    if (!migration || migration.to <= nextVersion) {
      throw new Error("Incompatible collaboration document");
    }
    doc.transact(() => {
      migration.migrate(doc);
      meta.set("documentVersion", migration.to);
      meta.set("lastMigration", migration.id);
    }, "collaboration-migration");
    nextVersion = migration.to;
  }
};
