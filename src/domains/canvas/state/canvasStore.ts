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
  transactWithHistory,
} from "@/shared/lib/yjs-setup";
import type { CanvasSession, CanvasState } from "./interfaces";
import type {
  AnimationCanvasSize,
  Point,
  StructuredNode,
} from "@/shared/types";
import { normalizeBrushChar } from "@/shared/utils/characters";
import {
  createDrawingSlice,
  createTextSlice,
  createSelectionSlice,
  createSessionSlice,
  createAnimationSlice,
  createStaticGridSlice,
} from "./slices";
import { sceneToGridEntries } from "@/shared/utils/structured";
import {
  rebuildGridFromYMap,
  rebuildSceneFromYMap,
  patchGridByChangedKeys,
  applyFreeformSnapshotToYMaps,
  applyStructuredSnapshotToYMaps,
} from "./helpers/gridHelpers";
import {
  withActiveCanvasSnapshot,
  normalizeSessionMode,
} from "./helpers/sessionHelpers";
import {
  cloneScene,
  normalizeAndCloneScene,
  createMapFromEntries,
  normalizeGridEntries,
  toStructuredNode,
} from "./helpers/snapshotHelpers";
import {
  cloneAnimationTimeline,
  getAnimationFrameEntries,
  normalizeAnimationCanvasSize,
  normalizeAnimationTimeline,
} from "./helpers/animationHelpers";

export type { CanvasState };

import {
  DEFAULT_SESSION_ID,
  DEFAULT_SESSION_NAME,
  DEFAULT_MODE,
  isToolAllowedForMode,
  buildSessionSnapshot,
  resolveSessionRuntime,
  normalizeSessionViewport,
} from "./helpers/storeUtils";
import { DEFAULT_DEMO_GRID } from "./helpers/defaultDemo";

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get, ...a) => {
      if (yMainGrid.size === 0 && yStructuredScene.size === 0) {
        applyFreeformSnapshotToYMaps(DEFAULT_DEMO_GRID);
      }

      yMainGrid.observe((event) => {
        const currentGrid = get().grid;
        const patchedGrid = patchGridByChangedKeys(currentGrid, event.keysChanged);
        if (patchedGrid) {
          set({ grid: patchedGrid });
          return;
        }

        if (event.keysChanged.size === 0 && yMainGrid.size !== currentGrid.size) {
          set({ grid: rebuildGridFromYMap() });
        }
      });

      yStructuredScene.observe(() => {
        set({ structuredScene: rebuildSceneFromYMap() });
      });

      return {
        offset: { x: 0, y: 0 },
        zoom: 1,
        grid: createMapFromEntries(DEFAULT_DEMO_GRID),
        canvasMode: DEFAULT_MODE,
        structuredScene: [],
        canvasBounds: null,
        animationTimeline: null,
        animationIsPlaying: false,
        canvasSessions: [
          {
            id: DEFAULT_SESSION_ID,
            name: DEFAULT_SESSION_NAME,
            mode: DEFAULT_MODE,
            scene: [],
            grid: DEFAULT_DEMO_GRID,
          },
        ],
        activeCanvasId: DEFAULT_SESSION_ID,
        activeCanvasHasSavedViewport: false,
        tool: "select",
        brushChar: DEFAULT_BRUSH_CHAR,
        brushColor: COLOR_PRIMARY_TEXT,
        showGrid: true,
        exportShowGrid: false,
        hoveredGrid: null,

        setOffset: (updater) =>
          set((state) => ({ offset: updater(state.offset) })),
        setZoom: (updater) =>
          set((state) => ({
            zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, updater(state.zoom))),
          })),
        setTool: (tool) =>
          set((state) => {
            if (!isToolAllowedForMode(tool, state.canvasMode)) return state;
            return { tool, textCursor: null, hoveredGrid: null };
          }),
        applyStructuredScene: (scene, shouldSaveHistory = true) => {
          const normalizedScene = normalizeAndCloneScene(scene);
          const gridEntries = sceneToGridEntries(normalizedScene);
          transactWithHistory(() => {
            yStructuredScene.clear();
            normalizedScene.forEach((node) => {
              yStructuredScene.set(node.id, node);
            });
            yMainGrid.clear();
            gridEntries.forEach(([key, val]) => yMainGrid.set(key, val));
          }, shouldSaveHistory);
          set((state) => ({
            structuredScene: normalizedScene,
            grid: createMapFromEntries(gridEntries),
            canvasSessions: withActiveCanvasSnapshot(
              state.canvasSessions,
              state.activeCanvasId,
              {
                mode: state.canvasMode,
                scene: normalizedScene,
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
        setShowGrid: (show) => set({ showGrid: show }),
        setExportShowGrid: (show) => set({ exportShowGrid: show }),
        setHoveredGrid: (pos) => set({ hoveredGrid: pos }),
        ...createSessionSlice(set, get, ...a),
        ...createAnimationSlice(set, get, ...a),
        ...createStaticGridSlice(set, get, ...a),

        ...createDrawingSlice(set, get, ...a),
        ...createTextSlice(set, get, ...a),
        ...createSelectionSlice(set, get, ...a),
      };
    },
    {
      name: "ascii-canvas-persistence",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => {
        const activeSnapshot = buildSessionSnapshot(state);
        return {
          offset: state.offset,
          zoom: state.zoom,
          canvasMode: state.canvasMode,
          structuredScene: cloneScene(state.structuredScene),
          canvasBounds: state.canvasBounds ? { ...state.canvasBounds } : null,
          animationTimeline: state.animationTimeline
            ? cloneAnimationTimeline(state.animationTimeline)
            : null,
          brushChar: state.brushChar,
          brushColor: state.brushColor,
          showGrid: state.showGrid,
          exportShowGrid: state.exportShowGrid,
          canvasSessions: withActiveCanvasSnapshot(
            state.canvasSessions,
            state.activeCanvasId,
            activeSnapshot
          ),
          activeCanvasId: state.activeCanvasId,
          grid:
            state.canvasMode === "structured"
              ? sceneToGridEntries(state.structuredScene)
              : Array.from(state.grid.entries()),
        };
      },
      onRehydrateStorage: () => {
        const hasPersistedState =
          typeof localStorage !== "undefined" &&
          localStorage.getItem("ascii-canvas-persistence") !== null;

        return (hydratedState, error) => {
          if (error || !hydratedState) return;
          const hState = hydratedState as CanvasState & {
            canvasSessions?: unknown;
            activeCanvasId?: unknown;
            canvasMode?: unknown;
            structuredScene?: unknown;
          };
          hState.brushChar = normalizeBrushChar(
            hState.brushChar,
            DEFAULT_BRUSH_CHAR
          );

          const legacyGridEntries = normalizeGridEntries(hState.grid);
          const legacyViewport = normalizeSessionViewport({
            offset: hState.offset as Point,
            zoom: hState.zoom,
          });
          const legacyMode = normalizeSessionMode(hState.canvasMode);
          const legacyScene = Array.isArray(hState.structuredScene)
            ? (hState.structuredScene
                .map((item) => toStructuredNode(item))
                .filter(
                  (item): item is StructuredNode => !!item
                ) as StructuredNode[])
            : [];

          const recoveredSessions: CanvasSession[] = Array.isArray(
            hState.canvasSessions
          )
            ? hState.canvasSessions
                .map((raw): CanvasSession | null => {
                  if (!raw || typeof raw !== "object") return null;
                  const maybe = raw as Partial<CanvasSession> & {
                    mode?: unknown;
                    scene?: unknown;
                  };
                  if (typeof maybe.id !== "string") return null;
                  const mode = normalizeSessionMode(maybe.mode);
                  const viewport = normalizeSessionViewport(maybe.viewport);
                  const scene = Array.isArray(maybe.scene)
                    ? maybe.scene
                        .map((item) => toStructuredNode(item))
                        .filter(
                          (item): item is StructuredNode => !!item
                        )
                    : [];

                  if (mode === "animation") {
                    const size = normalizeAnimationCanvasSize(
                      maybe.size as Partial<AnimationCanvasSize> | undefined
                    );
                    const timeline = normalizeAnimationTimeline(
                      maybe.timeline,
                      normalizeGridEntries(maybe.grid)
                    );
                    return {
                      id: maybe.id,
                      name:
                        typeof maybe.name === "string" && maybe.name.trim()
                          ? maybe.name
                          : "Canvas",
                      mode,
                      scene: [],
                      grid: getAnimationFrameEntries(timeline, timeline.currentFrameId),
                      size,
                      timeline,
                      ...(viewport ? { viewport } : {}),
                    } satisfies CanvasSession;
                  }

                  return {
                    id: maybe.id,
                    name:
                      typeof maybe.name === "string" && maybe.name.trim()
                        ? maybe.name
                        : "Canvas",
                    mode,
                    scene: normalizeAndCloneScene(scene),
                    grid: normalizeGridEntries(maybe.grid),
                    ...(viewport ? { viewport } : {}),
                  } satisfies CanvasSession;
                })
                .filter((session): session is CanvasSession => session !== null)
            : [];

          const sessions =
            recoveredSessions.length > 0
              ? recoveredSessions
              : [
                  {
                    id: DEFAULT_SESSION_ID,
                    name: DEFAULT_SESSION_NAME,
                    mode: legacyMode,
                    scene: normalizeAndCloneScene(legacyScene),
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
            sessionsWithActiveViewport.find((session) => session.id === activeCanvasId) ??
            sessionsWithActiveViewport[0];
          const currentTool = hState.tool || "select";
          const runtime = resolveSessionRuntime(activeSession, currentTool);

          hState.canvasSessions = sessionsWithActiveViewport;
          hState.activeCanvasId = activeCanvasId;
          hState.canvasMode = runtime.nextMode;
          hState.structuredScene = runtime.nextScene;
          hState.grid = createMapFromEntries(runtime.nextGridEntries);
          hState.tool = runtime.nextTool;
          hState.canvasBounds = runtime.nextBounds;
          hState.animationTimeline = runtime.nextTimeline;
          hState.offset = runtime.nextOffset;
          hState.zoom = runtime.nextZoom;
          hState.activeCanvasHasSavedViewport = runtime.hasSavedViewport;
          hState.animationIsPlaying = false;

          if (runtime.nextMode === "structured") {
            applyStructuredSnapshotToYMaps(runtime.nextScene);
          } else {
            applyFreeformSnapshotToYMaps(runtime.nextGridEntries);
          }
        };
      },
    }
  )
);
