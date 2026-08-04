import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  MIN_ZOOM,
  MAX_ZOOM,
  COLOR_PRIMARY_TEXT,
  DEFAULT_BRUSH_CHAR,
} from "@/shared/lib/constants";
import {
  yMainGrid,
  yStructuredScene,
  yStructuredComponents,
  activateCanvasDocument,
  observeActiveGrid,
  observeActiveScene,
  observeActiveComponents,
  runCanvasTransaction,
} from "./yjs";
import type { EditorState } from "./interfaces";
import {
  EDITOR_PERSISTENCE_KEY,
  EDITOR_PERSISTENCE_V2_BACKUP_KEY,
  EDITOR_PERSISTENCE_VERSION,
  flattenPersistedEditorState,
  isPersistedEditorStateV3,
  migratePersistedStateToV3,
  type CanvasSession,
} from "@/domains/sessions/public";
import type { Point } from "@/shared/types";
import type { StructuredNode } from "@/domains/structured-content/public";
import { normalizeBrushChar } from "@/shared/utils/characters";
import {
  createDrawingSlice,
  createTextSlice,
  createSelectionSlice,
  createSessionSlice,
  createStaticGridSlice,
} from "./slices";
import { sceneToGridEntries } from "@/domains/structured-content/public";
import {
  rebuildGridFromYMap,
  rebuildSceneFromYMap,
  patchGridByChangedKeys,
  applyFreeformSnapshotToYMaps,
} from "./helpers/gridHelpers";
import {
  withActiveCanvasSnapshot,
  normalizeSessionMode,
} from "@/domains/sessions/public";
import {
  cloneScene,
  normalizeAndCloneScene,
  createMapFromEntries,
  normalizeGridEntries,
  toStructuredNode,
} from "./helpers/snapshotHelpers";
import {
  deriveStructuredComponentsFromScene,
  normalizeStructuredComponents,
} from "@/domains/structured-content/public";import { isCollaborationDescriptor } from "@/domains/collaboration/public";

export type { EditorState };

import {
  DEFAULT_SESSION_ID,
  DEFAULT_SESSION_NAME,
  DEFAULT_STRUCTURED_SESSION_ID,
  DEFAULT_STRUCTURED_SESSION_NAME,
  DEFAULT_MODE,
  isToolAllowedForMode,
  buildSessionSnapshot,
  resolveSessionRuntime,
  normalizeSessionViewport,
} from "./helpers/storeUtils";
import { DEFAULT_DEMO_GRID } from "./helpers/defaultDemo";
import { buildStructuredTemplate } from "@/domains/structured-content/public";

const DEFAULT_STRUCTURED_SAFARI_TEMPLATE = buildStructuredTemplate(
  "safari",
  { x: 4, y: 2 },
  {
    brushColor: COLOR_PRIMARY_TEXT,
    startOrder: 1,
  }
);
const DEFAULT_STRUCTURED_SAFARI_GRID = sceneToGridEntries(
  DEFAULT_STRUCTURED_SAFARI_TEMPLATE.nodes
);

const createDefaultCanvasSessions = (): CanvasSession[] => [
  {
    id: DEFAULT_SESSION_ID,
    name: DEFAULT_SESSION_NAME,
    mode: DEFAULT_MODE,
    scene: [],
    grid: DEFAULT_DEMO_GRID,
  },
  {
    id: DEFAULT_STRUCTURED_SESSION_ID,
    name: DEFAULT_STRUCTURED_SESSION_NAME,
    mode: "structured",
    scene: DEFAULT_STRUCTURED_SAFARI_TEMPLATE.nodes,
    components: DEFAULT_STRUCTURED_SAFARI_TEMPLATE.components,
    grid: DEFAULT_STRUCTURED_SAFARI_GRID,
  },
];

type RecoverableEditorState = EditorState & {
  canvasSessions?: unknown;
  activeCanvasId?: unknown;
  canvasMode?: unknown;
  structuredScene?: unknown;
  structuredComponents?: unknown;
};

const recoverPersistedEditorState = (
  hydratedState: EditorState,
  hasPersistedState: boolean
): EditorState => {
  const hState = { ...hydratedState } as RecoverableEditorState;
  hState.brushChar = normalizeBrushChar(
    hState.brushChar,
    DEFAULT_BRUSH_CHAR
  );
  hState.brushColor =
    typeof hState.brushColor === "string"
      ? hState.brushColor
      : COLOR_PRIMARY_TEXT;
  hState.showGrid =
    typeof hState.showGrid === "boolean" ? hState.showGrid : true;
  hState.exportShowGrid =
    typeof hState.exportShowGrid === "boolean"
      ? hState.exportShowGrid
      : false;

  const legacyGridEntries = normalizeGridEntries(hState.grid);
  const legacyViewport = normalizeSessionViewport({
    offset: hState.offset as Point,
    zoom: hState.zoom,
  });
  const legacyMode = normalizeSessionMode(hState.canvasMode);
  const legacyScene = Array.isArray(hState.structuredScene)
    ? (hState.structuredScene
        .map((item) => toStructuredNode(item))
        .filter((item): item is StructuredNode => !!item) as StructuredNode[])
    : [];
  const legacyComponents = Array.isArray(hState.structuredComponents)
    ? normalizeStructuredComponents(
        hState.structuredComponents as never,
        legacyScene
      )
    : normalizeStructuredComponents(undefined, legacyScene);

  const recoveredSessions: CanvasSession[] = Array.isArray(
    hState.canvasSessions
  )
    ? hState.canvasSessions
        .map((raw): CanvasSession | null => {
          if (!raw || typeof raw !== "object") return null;
          const maybe = raw as Partial<CanvasSession> & {
            mode?: unknown;
            scene?: unknown;
            components?: unknown;
          };
          if (typeof maybe.id !== "string") return null;
          if ((raw as { mode?: unknown }).mode === "animation") return null;
          const mode = normalizeSessionMode(maybe.mode);
          const viewport = normalizeSessionViewport(maybe.viewport);
          const scene = Array.isArray(maybe.scene)
            ? maybe.scene
                .map((item) => toStructuredNode(item))
                .filter((item): item is StructuredNode => !!item)
            : [];
          const components = Array.isArray(maybe.components)
            ? normalizeStructuredComponents(maybe.components as never, scene)
            : normalizeStructuredComponents(undefined, scene);
          const collaboration = isCollaborationDescriptor(maybe.collaboration)
            ? maybe.collaboration
            : undefined;

          return {
            id: maybe.id,
            name:
              typeof maybe.name === "string" && maybe.name.trim()
                ? maybe.name
                : "Canvas",
            mode,
            scene: normalizeAndCloneScene(scene),
            components,
            grid: normalizeGridEntries(maybe.grid),
            ...(viewport ? { viewport } : {}),
            ...(collaboration ? { collaboration } : {}),
          } satisfies CanvasSession;
        })
        .filter((session): session is CanvasSession => session !== null)
    : [];

  const sessions =
    recoveredSessions.length > 0
      ? recoveredSessions
      : !hasPersistedState
        ? createDefaultCanvasSessions()
        : [
            {
              id: DEFAULT_SESSION_ID,
              name: DEFAULT_SESSION_NAME,
              mode: legacyMode,
              scene: normalizeAndCloneScene(legacyScene),
              components: legacyComponents,
              grid:
                !hasPersistedState && legacyGridEntries.length === 0
                  ? DEFAULT_DEMO_GRID
                  : legacyGridEntries,
              ...(legacyViewport ? { viewport: legacyViewport } : {}),
            },
          ];

  const activeCanvasId =
    typeof hState.activeCanvasId === "string" &&
    sessions.some((session) => session.id === hState.activeCanvasId)
      ? hState.activeCanvasId
      : sessions[0].id;

  const sessionsWithActiveViewport = sessions.map((session) =>
    session.id === activeCanvasId && !session.viewport && legacyViewport
      ? { ...session, viewport: legacyViewport }
      : session
  );
  const activeSession =
    sessionsWithActiveViewport.find(
      (session) => session.id === activeCanvasId
    ) ?? sessionsWithActiveViewport[0];
  const currentTool = hState.tool || "select";
  const runtime = resolveSessionRuntime(activeSession, currentTool);

  hState.canvasSessions = sessionsWithActiveViewport;
  hState.activeCanvasId = activeCanvasId;
  hState.canvasMode = runtime.nextMode;
  hState.structuredScene = runtime.nextScene;
  hState.structuredComponents = runtime.nextComponents;
  hState.selectedStructuredNodeIds = [];
  hState.selectedStructuredBoxId = null;
  hState.selectedStructuredSplitHandle = null;
  hState.structuredContextPoint = null;
  hState.grid = createMapFromEntries(runtime.nextGridEntries);
  hState.tool = runtime.nextTool;
  hState.offset = runtime.nextOffset;
  hState.zoom = runtime.nextZoom;
  hState.activeCanvasHasSavedViewport = runtime.hasSavedViewport;

  return hState as EditorState;
};

const syncHydratedStateToYMaps = (hydratedState: EditorState) => {
  activateCanvasDocument(
    hydratedState.activeCanvasId,
    {
      grid: Array.from(hydratedState.grid.entries()),
      scene:
        hydratedState.canvasMode === "structured"
          ? hydratedState.structuredScene
          : [],
      components: hydratedState.structuredComponents,
    },
    { replace: true }
  );
};

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

      observeActiveGrid((event) => {
        const currentGrid = get().grid;
        const patchedGrid = patchGridByChangedKeys(currentGrid, event.keysChanged);
        if (patchedGrid) {
          set((state) => ({
            grid: patchedGrid,
            canvasSessions: state.canvasSessions.map((session) =>
              session.id === state.activeCanvasId
                ? { ...session, grid: Array.from(patchedGrid.entries()) }
                : session
            ),
          }));
          return;
        }

        if (event.keysChanged.size === 0 && yMainGrid.size !== currentGrid.size) {
          const grid = rebuildGridFromYMap();
          set((state) => ({
            grid,
            canvasSessions: state.canvasSessions.map((session) =>
              session.id === state.activeCanvasId
                ? { ...session, grid: Array.from(grid.entries()) }
                : session
            ),
          }));
        }
      });

      observeActiveScene(() => {
        set((state) => {
          const structuredScene = rebuildSceneFromYMap();
          return {
            structuredScene,
            structuredComponents: normalizeStructuredComponents(
              state.structuredComponents,
              structuredScene
            ),
            canvasSessions: state.canvasSessions.map((session) =>
              session.id === state.activeCanvasId
                ? { ...session, scene: structuredScene }
                : session
            ),
          };
        });
      });

      observeActiveComponents(() => {
        set((state) => {
          const structuredComponents = Array.from(yStructuredComponents.values());
          return {
            structuredComponents,
            canvasSessions: state.canvasSessions.map((session) =>
              session.id === state.activeCanvasId
                ? { ...session, components: structuredComponents }
                : session
            ),
          };
        });
      });

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
        tool: "select",
        brushChar: DEFAULT_BRUSH_CHAR,
        brushColor: COLOR_PRIMARY_TEXT,
        showGrid: true,
        exportShowGrid: false,
        hoveredGrid: null,
        canvasColorPickerTarget: null,

        setOffset: (updater) =>
          set((state) => ({ offset: updater(state.offset) })),
        setZoom: (updater) =>
          set((state) => ({
            zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, updater(state.zoom))),
          })),
        setTool: (tool) =>
          set((state) => {
            if (!isToolAllowedForMode(tool, state.canvasMode)) return state;
            return { tool, textCursor: null, editingStructuredTextNodeId: null, structuredTextSelection: null, hoveredGrid: null };
          }),
        applyStructuredScene: (scene, history = "save", components) => {
          const normalizedScene = normalizeAndCloneScene(scene);
          const componentSource =
            components ??
            [
              ...get().structuredComponents,
              ...deriveStructuredComponentsFromScene(normalizedScene).filter(
                (component) =>
                  !get().structuredComponents.some(
                    (existing) => existing.id === component.id
                  )
              ),
            ];
          const normalizedComponents = normalizeStructuredComponents(
            componentSource,
            normalizedScene
          );
          const gridEntries = sceneToGridEntries(normalizedScene);
          runCanvasTransaction(() => {
            yStructuredScene.clear();
            normalizedScene.forEach((node) => {
              yStructuredScene.set(node.id, node);
            });
            yStructuredComponents.clear();
            normalizedComponents.forEach((component) => {
              yStructuredComponents.set(component.id, component);
            });
            yMainGrid.clear();
            gridEntries.forEach(([key, val]) => yMainGrid.set(key, val));
          }, history);
          set((state) => ({
            structuredScene: normalizedScene,
            structuredComponents: normalizedComponents,
            selectedStructuredNodeIds: state.selectedStructuredNodeIds.filter((id) =>
              normalizedScene.some((node) => node.id === id)
            ),
            selectedStructuredBoxId: state.selectedStructuredBoxId && normalizedScene.some((node) => node.id === state.selectedStructuredBoxId && node.type === "box")
              ? state.selectedStructuredBoxId
              : null,
            selectedStructuredSplitHandle:
              state.selectedStructuredSplitHandle &&
              normalizedScene.some(
                (node) =>
                  node.id === state.selectedStructuredSplitHandle?.nodeId &&
                  node.type === "splitBox"
              )
                ? state.selectedStructuredSplitHandle
                : null,
            editingStructuredTextNodeId:
              state.editingStructuredTextNodeId &&
              normalizedScene.some((node) => node.id === state.editingStructuredTextNodeId && node.type === "text")
                ? state.editingStructuredTextNodeId
                : null,
            structuredTextSelection:
              state.structuredTextSelection &&
              normalizedScene.some((node) => node.id === state.structuredTextSelection?.nodeId && node.type === "text")
                ? state.structuredTextSelection
                : null,
            grid: createMapFromEntries(gridEntries),
            canvasSessions: withActiveCanvasSnapshot(
              state.canvasSessions,
              state.activeCanvasId,
              {
                mode: state.canvasMode,
                scene: normalizedScene,
                components: normalizedComponents,
                grid: gridEntries,
              }
            ),
          }));
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
        setCanvasColorPickerTarget: (target) =>
          set({ canvasColorPickerTarget: target }),
        setStructuredContextPoint: (point) =>
          set({ structuredContextPoint: point ? { ...point } : null }),
        setShowGrid: (show) => set({ showGrid: show }),
        setExportShowGrid: (show) => set({ exportShowGrid: show }),
        setHoveredGrid: (pos) => set({ hoveredGrid: pos }),
        setStructuredGridFocus: (point) =>
          set({
            structuredGridFocus: point ? { ...point } : null,
            ...(point
              ? {
                  selectedStructuredNodeIds: [],
                  selectedStructuredBoxId: null,
                  selectedStructuredSplitHandle: null,
                  structuredContextPoint: null,
                  editingStructuredTextNodeId: null,
                  structuredTextSelection: null,
                  textCursor: null,
                  selections: [],
                }
              : {}),
          }),
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

        ...createDrawingSlice(set, get, ...a),
        ...createTextSlice(set, get, ...a),
        ...createSelectionSlice(set, get, ...a),
      };
    },
    {
      name: EDITOR_PERSISTENCE_KEY,
      version: EDITOR_PERSISTENCE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => {
        const activeSnapshot = buildSessionSnapshot(state);
        return {
          schemaVersion: EDITOR_PERSISTENCE_VERSION,
          workspace: {
            offset: state.offset,
            zoom: state.zoom,
            canvasMode: state.canvasMode,
            structuredScene: cloneScene(state.structuredScene),
            structuredComponents: normalizeStructuredComponents(
              state.structuredComponents,
              state.structuredScene
            ),
            grid:
              state.canvasMode === "structured"
                ? sceneToGridEntries(state.structuredScene)
                : Array.from(state.grid.entries()),
          },
          sessions: {
            items: withActiveCanvasSnapshot(
              state.canvasSessions,
              state.activeCanvasId,
              activeSnapshot
            ),
            activeId: state.activeCanvasId,
          },
          preferences: {
            brushChar: state.brushChar,
            brushColor: state.brushColor,
            showGrid: state.showGrid,
            exportShowGrid: state.exportShowGrid,
          },
        } as unknown as Partial<EditorState>;
      },
      migrate: (persistedState, persistedVersion) => {
        if (isPersistedEditorStateV3(persistedState)) return persistedState;
        if (
          persistedVersion < EDITOR_PERSISTENCE_VERSION &&
          typeof localStorage !== "undefined"
        ) {
          const raw = localStorage.getItem(EDITOR_PERSISTENCE_KEY);
          if (raw && !localStorage.getItem(EDITOR_PERSISTENCE_V2_BACKUP_KEY)) {
            localStorage.setItem(EDITOR_PERSISTENCE_V2_BACKUP_KEY, raw);
          }
        }
        return migratePersistedStateToV3(persistedState);
      },
      merge: (persistedState, currentState) => {
        if (!persistedState) return currentState;
        const normalizedPersistedState = isPersistedEditorStateV3(
          persistedState
        )
          ? persistedState
          : migratePersistedStateToV3(persistedState);
        const flattened = flattenPersistedEditorState(
          normalizedPersistedState
        );
        const mergedState = {
          ...currentState,
          ...flattened,
          grid: createMapFromEntries(normalizeGridEntries(flattened.grid)),
        } as EditorState;
        return recoverPersistedEditorState(mergedState, true);
      },
      onRehydrateStorage: () => (hydratedState, error) => {
        if (error || !hydratedState) return;
        syncHydratedStateToYMaps(hydratedState);
      },
    }
  )
);
