import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MIN_ZOOM, MAX_ZOOM, COLOR_PRIMARY_TEXT, DEFAULT_BRUSH_CHAR } from "@/shared/lib/constants";
import {
  yMainGrid,
  yStructuredScene,
  activateCanvasDocument,
  getCanvasHistoryAvailability,
  subscribeCanvasHistoryAvailability,
  replaceStructuredCanvasContent,
} from "./canvasDocument";
import type { EditorState } from "./interfaces";
import {
  EDITOR_PERSISTENCE_KEY,
  EDITOR_PERSISTENCE_VERSION,
  flattenPersistedEditorState,
  decodePersistedEditorState,
  migrateLegacyEditorPersistence,
  migratePersistedStateToV5,
} from "@/domains/sessions/public";
import {
  createDrawingSlice,
  createTextSlice,
  createSelectionSlice,
  createSessionSlice,
  createStaticGridSlice,
  createSlideSlice,
} from "./slices";
import { applyFreeformSnapshotToYMaps } from "./helpers/gridHelpers";
import {
  createMapFromEntries,
  normalizeAndCloneScene,
  normalizeGridEntries,
} from "./helpers/snapshotHelpers";
import {
  deriveStructuredComponentsFromScene,
  normalizeStructuredComponents,
} from "@/domains/structured-content/public";
import { normalizeBrushChar } from "@/shared/utils/characters";
import { subscribeCanvasDocumentProjection } from "./canvasDocumentProjection";
import {
  createDefaultCanvasSessions,
  createPersistedEditorSnapshot,
  recoverPersistedEditorState,
  shouldScheduleEditorPersistence,
  syncHydratedStateToCanvasDocument,
} from "./editorPersistence";

import {
  DEFAULT_SESSION_ID,
  DEFAULT_MODE,
  isToolAllowedForMode,
} from "./helpers/storeUtils";
import { DEFAULT_DEMO_GRID } from "./helpers/defaultDemo";
import { createDeferredSnapshotPersistStorage } from "./persistenceCoordinator";
import { createStructuredGridFocusPatch } from "./transitions/editorTransitions";

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get, ...a) => {
      activateCanvasDocument(DEFAULT_SESSION_ID, {
        grid: DEFAULT_DEMO_GRID,
        scene: [],
      });
      if (yMainGrid.size === 0 && yStructuredScene.size === 0) {
        applyFreeformSnapshotToYMaps(DEFAULT_DEMO_GRID);
      }

      subscribeCanvasDocumentProjection(set, get);

      subscribeCanvasHistoryAvailability((availability) => set(availability));

      return {
        offset: { x: 0, y: 0 },
        zoom: 1,
        grid: createMapFromEntries(DEFAULT_DEMO_GRID),
        canvasMode: DEFAULT_MODE,
        structuredScene: [],
        structuredComponents: [],
        selectedStructuredNodeIds: [],
        selectedStructuredBoxId: null,
        selectedStructuredSplitHandle: null,
        structuredContextPoint: null,
        structuredGridFocus: null,
        canvasSessions: createDefaultCanvasSessions(),
        activeCanvasId: DEFAULT_SESSION_ID,
        activeCanvasHasSavedViewport: false,
        ...getCanvasHistoryAvailability(),
        tool: "select",
        brushChar: DEFAULT_BRUSH_CHAR,
        brushColor: COLOR_PRIMARY_TEXT,
        showGrid: true,
        exportShowGrid: false,
        hoveredGrid: null,
        canvasColorPickerTarget: null,

        setOffset: (updater) => set((state) => ({ offset: updater(state.offset) })),
        setZoom: (updater) =>
          set((state) => ({
            zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, updater(state.zoom))),
          })),
        setViewport: (updater) =>
          set((state) => {
            const viewport = updater({ offset: state.offset, zoom: state.zoom });
            return {
              offset: viewport.offset,
              zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewport.zoom)),
            };
          }),
        setTool: (tool) =>
          set((state) => {
            if (!isToolAllowedForMode(tool, state.canvasMode)) return state;
            return {
              tool,
              textCursor: null,
              editingStructuredTextNodeId: null,
              structuredTextSelection: null,
              hoveredGrid: null,
            };
          }),
        applyStructuredScene: (scene, history = "save", components) => {
          const normalizedScene = normalizeAndCloneScene(scene);
          const componentSource = components ?? [
            ...get().structuredComponents,
            ...deriveStructuredComponentsFromScene(normalizedScene).filter(
              (component) =>
                !get().structuredComponents.some((existing) => existing.id === component.id)
            ),
          ];
          const normalizedComponents = normalizeStructuredComponents(
            componentSource,
            normalizedScene
          );
          replaceStructuredCanvasContent(
            normalizedScene,
            normalizedComponents,
            history
          );
        },
        getNextStructuredOrder: () => {
          const scene = get().structuredScene;
          if (scene.length === 0) return 1;
          return Math.max(...scene.map((node) => node.order)) + 1;
        },
        setBrushChar: (char) =>
          set((state) => ({
            brushChar: normalizeBrushChar(char, state.brushChar),
          })),
        setBrushColor: (color) => set({ brushColor: color }),
        setCanvasColorPickerTarget: (target) => set({ canvasColorPickerTarget: target }),
        setStructuredContextPoint: (point) =>
          set({ structuredContextPoint: point ? { ...point } : null }),
        setShowGrid: (show) => set({ showGrid: show }),
        setExportShowGrid: (show) => set({ exportShowGrid: show }),
        setHoveredGrid: (pos) => set({ hoveredGrid: pos }),
        setStructuredGridFocus: (point) =>
          set(createStructuredGridFocusPatch(point)),
        moveStructuredGridFocus: (dx, dy) =>
          set((state) => {
            const current = state.structuredGridFocus ?? { x: 0, y: 0 };
            return {
              structuredGridFocus: {
                x: current.x + dx,
                y: current.y + dy,
              },
            };
          }),
        ...createSessionSlice(set, get, ...a),
        ...createStaticGridSlice(set, get, ...a),
        ...createSlideSlice(set, get, ...a),

        ...createDrawingSlice(set, get, ...a),
        ...createTextSlice(set, get, ...a),
        ...createSelectionSlice(set, get, ...a),
      };
    },
    {
      name: EDITOR_PERSISTENCE_KEY,
      version: EDITOR_PERSISTENCE_VERSION,
      storage: createDeferredSnapshotPersistStorage({
        getStorage: () => {
          migrateLegacyEditorPersistence(localStorage);
          return localStorage;
        },
        createSnapshot: createPersistedEditorSnapshot,
        shouldSchedule: shouldScheduleEditorPersistence,
      }),
      migrate: (persistedState) => {
        // Zustand types migrations as runtime state, while storage owns the V5 DTO.
        return migratePersistedStateToV5(persistedState) as unknown as EditorState;
      },
      merge: (persistedState, currentState) => {
        if (!persistedState) return currentState;
        const normalizedPersistedState = decodePersistedEditorState(persistedState);
        const flattened = flattenPersistedEditorState(normalizedPersistedState);
        const mergedState = {
          ...currentState,
          ...flattened,
          grid: createMapFromEntries(normalizeGridEntries(flattened.grid)),
        } as EditorState;
        return recoverPersistedEditorState(mergedState);
      },
      onRehydrateStorage: () => (hydratedState, error) => {
        if (error || !hydratedState) return;
        syncHydratedStateToCanvasDocument(hydratedState);
      },
    }
  )
);
