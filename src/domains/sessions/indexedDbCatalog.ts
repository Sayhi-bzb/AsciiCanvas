import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CollaborationDescriptor } from "@/domains/collaboration/public";
import type { SlideSize } from "@/domains/slides/public";
import type { Point } from "@/shared/types";
import type { CanvasMode } from "./mode";

export const CANVAS_CATALOG_DATABASE = "chardesk-canvas-catalog";
export const CANVAS_CATALOG_VERSION = 1;
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
  name: string;
  mode: CanvasMode;
  viewport?: { offset: Point; zoom: number };
  collaboration?: CollaborationDescriptor;
  activeSlideId?: string;
};

export type CanvasCatalogSlide = {
  id: string;
  sessionId: string;
  name: string;
  size: SlideSize;
  order: number;
};

export type CanvasCatalogSnapshot = {
  activeSessionId: string;
  sessions: CanvasCatalogSession[];
  slides: CanvasCatalogSlide[];
  preferences: CanvasCatalogPreferences;
};

interface CanvasCatalogSchema extends DBSchema {
  workspace: {
    key: "current";
    value: {
      id: "current";
      schemaVersion: typeof CANVAS_CATALOG_VERSION;
      activeSessionId: string;
      migrationComplete: boolean;
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

const openCatalog = (): Promise<IDBPDatabase<CanvasCatalogSchema>> =>
  openDB<CanvasCatalogSchema>(CANVAS_CATALOG_DATABASE, CANVAS_CATALOG_VERSION, {
    upgrade(db) {
      db.createObjectStore("workspace", { keyPath: "id" });
      db.createObjectStore("sessions", { keyPath: "id" });
      const slides = db.createObjectStore("slides", {
        keyPath: ["sessionId", "id"],
      });
      slides.createIndex("by-session", "sessionId");
      db.createObjectStore("preferences", { keyPath: "id" });
    },
  });

export const createIndexedDbCanvasCatalog = async (): Promise<CanvasCatalog> => {
  const db = await openCatalog();
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
        activeSessionId: workspace.activeSessionId,
        sessions,
        slides: slides.sort((left, right) => left.order - right.order),
        preferences: canvasPreferences,
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
