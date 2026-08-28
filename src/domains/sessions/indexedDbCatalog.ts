import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CollaborationDescriptor } from "@/domains/collaboration/public";
import type { SlideSize } from "@/domains/slides/public";
import type { Point } from "@/shared/types";
import type { CanvasMode } from "./mode";

export const CANVAS_CATALOG_DATABASE = "chardesk-canvas-catalog";
export const CANVAS_CATALOG_VERSION = 2;
export const CANVAS_CATALOG_MARKER_KEY = "chardesk-canvas-catalog-ready-v1";

export type CanvasCatalogPreferences = {
  brushChar: string;
  brushColor: string;
  brushBackgroundColor: string;
  showGrid: boolean;
  exportShowGrid: boolean;
};

export type CanvasCatalogSession = {
  id: string;
  order?: number;
  name: string;
  mode: CanvasMode;
  viewport?: { offset: Point; zoom: number };
  collaboration?: CollaborationDescriptor;
  activeSlideId?: string;
  documentGeneration?: number;
  previousDocumentGeneration?: number;
};

export type CanvasCatalogSlide = {
  id: string;
  sessionId: string;
  name: string;
  size: SlideSize;
  order: number;
};

export type CanvasCatalogSnapshot = {
  revision: number;
  activeSessionId: string;
  sessions: CanvasCatalogSession[];
  slides: CanvasCatalogSlide[];
  preferences: CanvasCatalogPreferences;
  recoveredSources: string[];
  deletedSessionIds: string[];
};

interface CanvasCatalogSchema extends DBSchema {
  workspace: {
    key: "current";
    value: {
      id: "current";
      schemaVersion: typeof CANVAS_CATALOG_VERSION;
      activeSessionId: string;
      migrationComplete: boolean;
      revision?: number;
      recoveredSources?: string[];
      deletedSessionIds?: string[];
    };
  };
  sessions: {
    key: string;
    value: CanvasCatalogSession;
  };
  slides: {
    key: [string, string];
    value: CanvasCatalogSlide;
    indexes: { "by-session": string };
  };
  preferences: {
    key: "canvas";
    value: CanvasCatalogPreferences & { id: "canvas" };
  };
}

export type CanvasCatalog = {
  load: () => Promise<CanvasCatalogSnapshot | null>;
  save: (snapshot: CanvasCatalogSnapshot) => Promise<void>;
  close: () => void;
};

export type CanvasCatalogFailureReason =
  | "upgrade-blocked"
  | "storage-timeout"
  | "storage-unavailable";

export class CanvasCatalogOpenError extends Error {
  readonly reason: CanvasCatalogFailureReason;

  constructor(reason: CanvasCatalogFailureReason, message: string) {
    super(message);
    this.name = "CanvasCatalogOpenError";
    this.reason = reason;
  }
}

export type CanvasCatalogOpenOptions = {
  openTimeoutMs?: number;
  onUnavailable?: (reason: CanvasCatalogFailureReason) => void;
};

const CATALOG_OPEN_TIMEOUT = 5_000;

const openCatalog = async ({
  openTimeoutMs = CATALOG_OPEN_TIMEOUT,
  onUnavailable,
}: CanvasCatalogOpenOptions): Promise<IDBPDatabase<CanvasCatalogSchema>> => {
  let database: IDBPDatabase<CanvasCatalogSchema> | null = null;
  let rejectInterruption!: (error: CanvasCatalogOpenError) => void;
  let settled = false;
  const interruption = new Promise<never>((_, reject) => {
    rejectInterruption = reject;
  });
  const opening = openDB<CanvasCatalogSchema>(
    CANVAS_CATALOG_DATABASE,
    CANVAS_CATALOG_VERSION,
    {
      upgrade(db, oldVersion) {
        if (oldVersion >= 1) return;
        db.createObjectStore("workspace", { keyPath: "id" });
        db.createObjectStore("sessions", { keyPath: "id" });
        const slides = db.createObjectStore("slides", {
          keyPath: ["sessionId", "id"],
        });
        slides.createIndex("by-session", "sessionId");
        db.createObjectStore("preferences", { keyPath: "id" });
      },
      blocked() {
        rejectInterruption(new CanvasCatalogOpenError(
          "upgrade-blocked",
          "Canvas catalog upgrade is blocked by another tab"
        ));
      },
      blocking() {
        database?.close();
        onUnavailable?.("storage-unavailable");
      },
      terminated() {
        onUnavailable?.("storage-unavailable");
      },
    }
  );
  const timeout = setTimeout(() => {
    rejectInterruption(new CanvasCatalogOpenError(
      "storage-timeout",
      "Canvas catalog did not open in time"
    ));
  }, openTimeoutMs);
  void opening.then((opened) => {
    if (settled) opened.close();
  }).catch(() => undefined);

  try {
    database = await Promise.race([opening, interruption]);
    return database;
  } catch (error) {
    if (error instanceof CanvasCatalogOpenError) throw error;
    throw new CanvasCatalogOpenError(
      "storage-unavailable",
      error instanceof Error ? error.message : "Canvas catalog is unavailable"
    );
  } finally {
    settled = true;
    clearTimeout(timeout);
  }
};

export const createIndexedDbCanvasCatalog = async (
  options: CanvasCatalogOpenOptions = {}
): Promise<CanvasCatalog> => {
  const db = await openCatalog(options);
  return {
    load: async () => {
      const transaction = db.transaction(
        ["workspace", "sessions", "slides", "preferences"],
        "readonly"
      );
      const [workspace, sessions, slides, preferences] = await Promise.all([
        transaction.objectStore("workspace").get("current"),
        transaction.objectStore("sessions").getAll(),
        transaction.objectStore("slides").getAll(),
        transaction.objectStore("preferences").get("canvas"),
      ]);
      await transaction.done;
      if (!workspace?.migrationComplete || !preferences) return null;
      const canvasPreferences: CanvasCatalogPreferences = {
        brushChar: preferences.brushChar,
        brushColor: preferences.brushColor,
        brushBackgroundColor: preferences.brushBackgroundColor,
        showGrid: preferences.showGrid,
        exportShowGrid: preferences.exportShowGrid,
      };
      return {
        revision: workspace.revision ?? 0,
        activeSessionId: workspace.activeSessionId,
        sessions: sessions.sort(
          (left, right) => (left.order ?? 0) - (right.order ?? 0)
        ),
        slides: slides.sort((left, right) => left.order - right.order),
        preferences: canvasPreferences,
        recoveredSources: workspace.recoveredSources ?? [],
        deletedSessionIds: workspace.deletedSessionIds ?? [],
      };
    },
    save: async (snapshot) => {
      const transaction = db.transaction(
        ["workspace", "sessions", "slides", "preferences"],
        "readwrite"
      );
      const sessionStore = transaction.objectStore("sessions");
      const slideStore = transaction.objectStore("slides");
      await Promise.all([
        sessionStore.clear(),
        slideStore.clear(),
        transaction.objectStore("workspace").put({
          id: "current",
          schemaVersion: CANVAS_CATALOG_VERSION,
          activeSessionId: snapshot.activeSessionId,
          migrationComplete: true,
          revision: snapshot.revision,
          recoveredSources: snapshot.recoveredSources,
          deletedSessionIds: snapshot.deletedSessionIds,
        }),
        transaction.objectStore("preferences").put({
          id: "canvas",
          ...snapshot.preferences,
        }),
      ]);
      await Promise.all([
        ...snapshot.sessions.map((session) => sessionStore.put(session)),
        ...snapshot.slides.map((slide) => slideStore.put(slide)),
      ]);
      await transaction.done;
    },
    close: () => db.close(),
  };
};
