/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useLocalStorageState } from 'ahooks';
import {
  useCanvasRuntime,
  useCanvasState,
  type CanvasViewportState,
} from '@/domains/canvas/public';
import { CanvasEngineRuntime } from './CanvasEngineRuntime';
import { CanvasFrameScheduler, CanvasScopedFrameScheduler } from './FrameScheduler';

export type CanvasViewId = 'primary' | 'secondary';

const SPLIT_ENABLED_STORAGE_KEY = 'chardesk-canvas-split-enabled';
const SPLIT_RATIO_STORAGE_KEY = 'chardesk-canvas-split-ratio';
const DEFAULT_VIEWPORT: CanvasViewportState = { offset: { x: 0, y: 0 }, zoom: 1 };
export type CanvasViewSize = { width: number; height: number };
export type CanvasViewSnapshot = {
  sessionId: string | null;
  viewport: CanvasViewportState;
  size?: CanvasViewSize;
};

const DEFAULT_VIEW_SNAPSHOT: CanvasViewSnapshot = {
  sessionId: null,
  viewport: DEFAULT_VIEWPORT,
};
const EMPTY_SUBSCRIBE = () => () => undefined;
const GET_PRIMARY_VIEW_ID = () => 'primary' as const;
const GET_DEFAULT_VIEW_SNAPSHOT = () => DEFAULT_VIEW_SNAPSHOT;

const cloneViewport = (viewport: CanvasViewportState): CanvasViewportState => ({
  offset: { ...viewport.offset },
  zoom: viewport.zoom,
});

const sameViewport = (a: CanvasViewportState, b: CanvasViewportState) =>
  a.zoom === b.zoom && a.offset.x === b.offset.x && a.offset.y === b.offset.y;

const sameSize = (a: CanvasViewSize | undefined, b: CanvasViewSize) =>
  a?.width === b.width && a.height === b.height;

const viewportWorldCenter = (viewport: CanvasViewportState, size: CanvasViewSize) => ({
  x: (size.width / 2 - viewport.offset.x) / viewport.zoom,
  y: (size.height / 2 - viewport.offset.y) / viewport.zoom,
});

const centerViewport = (
  viewport: CanvasViewportState,
  size: CanvasViewSize,
  center: { x: number; y: number }
): CanvasViewportState => ({
  ...viewport,
  offset: {
    x: size.width / 2 - center.x * viewport.zoom,
    y: size.height / 2 - center.y * viewport.zoom,
  },
});

class CanvasViewRuntime {
  readonly engine: CanvasEngineRuntime;
  private snapshot: CanvasViewSnapshot;
  private readonly sessionViewports = new Map<string, CanvasViewportState>();
  private pendingWorldCenter: { x: number; y: number } | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly publish: (viewport: CanvasViewportState) => void;

  constructor(
    viewId: CanvasViewId,
    sessionId: string | null,
    viewport: CanvasViewportState,
    frameScheduler: CanvasFrameScheduler,
    publish: (viewport: CanvasViewportState) => void
  ) {
    this.snapshot = { sessionId, viewport: cloneViewport(viewport) };
    this.publish = publish;
    this.engine = new CanvasEngineRuntime({
      getViewport: this.getViewport,
      setViewport: this.setViewport,
    }, new CanvasScopedFrameScheduler(frameScheduler, viewId));
  }

  getSnapshot = () => this.snapshot;

  getViewport = () => this.snapshot.viewport;

  getSessionId = () => this.snapshot.sessionId;

  setViewport = (
    updater: (viewport: CanvasViewportState) => CanvasViewportState,
    publish = true
  ) => {
    const next = cloneViewport(updater(this.getViewport()));
    if (sameViewport(this.snapshot.viewport, next)) return;
    this.snapshot = { ...this.snapshot, viewport: next };
    this.listeners.forEach((listener) => listener());
    if (publish) this.publish(next);
  };

  setContainerSize = (size: CanvasViewSize | undefined) => {
    if (!size || size.width <= 0 || size.height <= 0) return;
    const previousSize = this.snapshot.size;
    const pendingCenter = this.pendingWorldCenter;
    this.pendingWorldCenter = null;

    if (!previousSize && !pendingCenter) {
      this.snapshot = { ...this.snapshot, size };
      this.listeners.forEach((listener) => listener());
      return;
    }
    if (sameSize(previousSize, size) && !pendingCenter) return;

    const center = pendingCenter ?? viewportWorldCenter(this.snapshot.viewport, previousSize!);
    const viewport = centerViewport(this.snapshot.viewport, size, center);
    const viewportChanged = !sameViewport(this.snapshot.viewport, viewport);
    this.snapshot = { ...this.snapshot, viewport, size };
    this.listeners.forEach((listener) => listener());
    if (viewportChanged) this.publish(viewport);
  };

  preserveWorldCenterOnNextResize(center: { x: number; y: number }) {
    this.pendingWorldCenter = center;
  }

  replaceViewport(viewport: CanvasViewportState, publish = false) {
    this.setViewport(() => viewport, publish);
  }

  bindSession(sessionId: string, fallbackViewport: CanvasViewportState) {
    const currentSessionId = this.snapshot.sessionId;
    if (currentSessionId === sessionId) return;
    if (currentSessionId) {
      this.sessionViewports.set(currentSessionId, cloneViewport(this.snapshot.viewport));
    }
    const viewport = cloneViewport(
      this.sessionViewports.get(sessionId) ?? fallbackViewport
    );
    this.snapshot = { ...this.snapshot, sessionId, viewport };
    this.listeners.forEach((listener) => listener());
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}

class CanvasWorkspaceRuntime {
  readonly views: Record<CanvasViewId, CanvasViewRuntime>;
  private readonly frameScheduler = new CanvasFrameScheduler();
  private readonly publishViewport: (viewport: CanvasViewportState) => void;
  private readonly switchSession: (sessionId: string) => void;
  private globalSessionId: string | null;
  private activeViewId: CanvasViewId = 'primary';
  private secondaryInitialized = false;
  private readonly activeListeners = new Set<() => void>();
  private ownerCount = 0;
  private releaseGeneration = 0;
  private disposed = false;

  constructor(
    sessionId: string | null,
    viewport: CanvasViewportState,
    publishViewport: (viewport: CanvasViewportState) => void,
    switchSession: (sessionId: string) => void
  ) {
    this.globalSessionId = sessionId;
    this.publishViewport = publishViewport;
    this.switchSession = switchSession;
    const publish = (viewId: CanvasViewId) => (next: CanvasViewportState) => {
      if (
        viewId === this.activeViewId &&
        this.views?.[viewId].getSessionId() === this.globalSessionId
      ) {
        this.publishViewport(cloneViewport(next));
      }
    };
    this.views = {
      primary: new CanvasViewRuntime(
        'primary',
        sessionId,
        viewport,
        this.frameScheduler,
        publish('primary')
      ),
      secondary: new CanvasViewRuntime(
        'secondary',
        sessionId,
        viewport,
        this.frameScheduler,
        publish('secondary')
      ),
    };
  }

  getActiveViewId = () => this.activeViewId;

  subscribeActive = (listener: () => void) => {
    this.activeListeners.add(listener);
    return () => this.activeListeners.delete(listener);
  };

  activate(viewId: CanvasViewId) {
    const changedView = this.activeViewId !== viewId;
    this.activeViewId = viewId;
    if (changedView) this.activeListeners.forEach((listener) => listener());

    const view = this.views[viewId];
    const sessionId = view.getSessionId();
    const viewport = cloneViewport(view.getViewport());
    if (sessionId && sessionId !== this.globalSessionId) {
      this.switchSession(sessionId);
      view.replaceViewport(viewport);
    } else {
      this.publishViewport(viewport);
    }
  }

  selectSession(viewId: CanvasViewId, sessionId: string, viewport: CanvasViewportState) {
    this.views[viewId].bindSession(sessionId, viewport);
    this.activate(viewId);
  }

  openSplit() {
    if (this.secondaryInitialized) return;
    this.secondaryInitialized = true;
    const primary = this.views.primary.getSnapshot();
    if (primary.sessionId) {
      this.views.secondary.bindSession(primary.sessionId, primary.viewport);
    }
    this.views.secondary.replaceViewport(primary.viewport);
    if (primary.size) {
      const center = viewportWorldCenter(primary.viewport, primary.size);
      this.views.primary.preserveWorldCenterOnNextResize(center);
      this.views.secondary.preserveWorldCenterOnNextResize(center);
    }
  }

  closeSplit() {
    // View bindings and cameras stay alive so reopening restores the workspace.
  }

  syncCanvasState(
    sessionId: string | null,
    viewport: CanvasViewportState,
    availableSessionIds: ReadonlySet<string>
  ) {
    this.globalSessionId = sessionId;
    if (sessionId) {
      for (const view of Object.values(this.views)) {
        const boundSessionId = view.getSessionId();
        if (!boundSessionId || !availableSessionIds.has(boundSessionId)) {
          view.bindSession(sessionId, viewport);
        }
      }
    }

    const activeView = this.views[this.activeViewId];
    if (sessionId && activeView.getSessionId() !== sessionId) {
      activeView.bindSession(sessionId, viewport);
      this.publishViewport(activeView.getViewport());
    } else {
      activeView.replaceViewport(viewport);
    }
  }

  acquire() {
    if (this.disposed) return () => undefined;
    this.ownerCount += 1;
    this.releaseGeneration += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.ownerCount = Math.max(0, this.ownerCount - 1);
      const generation = ++this.releaseGeneration;
      queueMicrotask(() => {
        if (
          !this.disposed &&
          this.ownerCount === 0 &&
          this.releaseGeneration === generation
        ) this.dispose();
      });
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.ownerCount = 0;
    this.releaseGeneration += 1;
    this.views.secondary.engine.dispose();
    this.views.primary.engine.dispose();
    this.frameScheduler.dispose();
  }
}

type CanvasWorkspaceContextValue = {
  runtime: CanvasWorkspaceRuntime;
  splitEnabled: boolean;
  setSplitEnabled: (enabled: boolean) => void;
  splitRatio: number;
  setSplitRatio: (ratio: number) => void;
  selectViewSession: (viewId: CanvasViewId, sessionId: string) => void;
};

type CanvasViewContextValue = {
  viewId: CanvasViewId;
  runtime: CanvasViewRuntime;
};

const CanvasWorkspaceContext = createContext<CanvasWorkspaceContextValue | null>(null);
const CanvasViewContext = createContext<CanvasViewContextValue | null>(null);

export function CanvasWorkspaceProvider({ children }: { children: ReactNode }) {
  const canvas = useCanvasRuntime();
  const activeCanvasId = useCanvasState((state) => state.activeCanvasId);
  const [runtime] = useState(() => {
    const state = canvas.getState();
    return new CanvasWorkspaceRuntime(
      state.activeCanvasId,
      { offset: state.offset, zoom: state.zoom },
      (viewport) => canvas.commands.viewport.setViewport(() => viewport),
      canvas.commands.sessions.switch
    );
  });
  const [storedSplitEnabled, storeSplitEnabled] = useLocalStorageState<boolean>(
    SPLIT_ENABLED_STORAGE_KEY,
    { defaultValue: false }
  );
  const [storedSplitRatio, storeSplitRatio] = useLocalStorageState<number>(
    SPLIT_RATIO_STORAGE_KEY,
    { defaultValue: 50 }
  );
  const splitEnabled = storedSplitEnabled ?? false;
  const splitRatio = Math.min(75, Math.max(25, storedSplitRatio ?? 50));
  useEffect(() => {
    const sync = () => {
      const state = canvas.getState();
      runtime.syncCanvasState(
        state.activeCanvasId,
        { offset: state.offset, zoom: state.zoom },
        new Set(state.canvasSessions.map((session) => session.id))
      );
    };
    sync();
    return canvas.subscribe((state, previous) => {
      if (
        state.activeCanvasId === previous.activeCanvasId &&
        state.offset === previous.offset &&
        state.zoom === previous.zoom &&
        state.canvasSessions === previous.canvasSessions
      ) return;
      sync();
    });
  }, [activeCanvasId, canvas, runtime]);

  useEffect(() => runtime.acquire(), [runtime]);

  useEffect(() => {
    if (splitEnabled) runtime.openSplit();
    else runtime.closeSplit();
  }, [runtime, splitEnabled]);

  const setSplitEnabled = useCallback((enabled: boolean) => {
    storeSplitEnabled(enabled);
  }, [storeSplitEnabled]);

  const setSplitRatio = useCallback((ratio: number) => {
    storeSplitRatio(Math.min(75, Math.max(25, ratio)));
  }, [storeSplitRatio]);
  const selectViewSession = useCallback((viewId: CanvasViewId, sessionId: string) => {
    const session = canvas.getState().canvasSessions.find((item) => item.id === sessionId);
    if (!session) return;
    runtime.selectSession(
      viewId,
      sessionId,
      session.viewport ?? DEFAULT_VIEWPORT
    );
  }, [canvas, runtime]);
  const value = useMemo<CanvasWorkspaceContextValue>(() => ({
    runtime,
    splitEnabled,
    setSplitEnabled,
    splitRatio,
    setSplitRatio,
    selectViewSession,
  }), [runtime, selectViewSession, setSplitEnabled, setSplitRatio, splitEnabled, splitRatio]);

  return createElement(CanvasWorkspaceContext.Provider, { value }, children);
}

export function CanvasViewProvider({
  viewId,
  children,
}: {
  viewId: CanvasViewId;
  children: ReactNode;
}) {
  const workspace = useCanvasWorkspace();
  const value = useMemo(() => ({ viewId, runtime: workspace.runtime.views[viewId] }), [
    viewId,
    workspace.runtime,
  ]);
  return createElement(CanvasViewContext.Provider, { value }, children);
}

export const useCanvasWorkspace = () => {
  const workspace = useContext(CanvasWorkspaceContext);
  if (!workspace) throw new Error('useCanvasWorkspace must be used within CanvasWorkspaceProvider');
  return workspace;
};

export const useCanvasWorkspaceOptional = () => useContext(CanvasWorkspaceContext);

export const useCanvasViewOptional = () => {
  const workspace = useContext(CanvasWorkspaceContext);
  const view = useContext(CanvasViewContext);
  const activeViewId = useSyncExternalStore(
    workspace?.runtime.subscribeActive ?? EMPTY_SUBSCRIBE,
    workspace?.runtime.getActiveViewId ?? GET_PRIMARY_VIEW_ID,
    workspace?.runtime.getActiveViewId ?? GET_PRIMARY_VIEW_ID
  );
  const selectedViewId = view?.viewId ?? activeViewId;
  const selectedRuntime = view?.runtime ?? workspace?.runtime.views[selectedViewId];
  const snapshot = useSyncExternalStore(
    selectedRuntime?.subscribe ?? EMPTY_SUBSCRIBE,
    selectedRuntime?.getSnapshot ?? GET_DEFAULT_VIEW_SNAPSHOT,
    selectedRuntime?.getSnapshot ?? GET_DEFAULT_VIEW_SNAPSHOT
  );
  if (!workspace || !selectedRuntime) return null;
  return {
    viewId: selectedViewId,
    runtime: selectedRuntime.engine,
    sessionId: snapshot.sessionId,
    viewport: snapshot.viewport,
    isActive: activeViewId === selectedViewId,
    activate: () => workspace.runtime.activate(selectedViewId),
    selectSession: (sessionId: string) =>
      workspace.selectViewSession(selectedViewId, sessionId),
    setOffset: (updater: (offset: CanvasViewportState['offset']) => CanvasViewportState['offset']) =>
      selectedRuntime.setViewport((current) => ({ ...current, offset: updater(current.offset) })),
    setZoom: (updater: (zoom: number) => number) =>
      selectedRuntime.setViewport((current) => ({
        ...current,
        zoom: updater(current.zoom),
      })),
    setViewport: selectedRuntime.setViewport,
    subscribeViewport: selectedRuntime.subscribe,
    getViewport: selectedRuntime.getViewport,
    containerSize: snapshot.size,
    setContainerSize: selectedRuntime.setContainerSize,
  };
};

export const useActiveCanvasView = () => {
  const workspace = useCanvasWorkspace();
  const activeViewId = useSyncExternalStore(
    workspace.runtime.subscribeActive,
    workspace.runtime.getActiveViewId,
    workspace.runtime.getActiveViewId
  );
  const view = workspace.runtime.views[activeViewId];
  const snapshot = useSyncExternalStore(view.subscribe, view.getSnapshot, view.getSnapshot);
  return {
    viewId: activeViewId,
    runtime: view.engine,
    sessionId: snapshot.sessionId,
    viewport: snapshot.viewport,
    containerSize: snapshot.size,
  };
};
