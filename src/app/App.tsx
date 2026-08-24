import { useLocalStorageState } from 'ahooks';
import { CanvasEditor } from '@/widgets/canvas-editor';
import {
  useCanvasPersistence,
  useCanvasRuntime,
  useCanvasState,
} from '@/domains/canvas/public';
import { Toolbar } from '@/widgets/toolbar/dock';
import {
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
  TooltipProvider,
  Toaster,
  StatusText,
  type StatusTone,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  UiProvider,
} from '@chardesk/ui';
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { feedback } from '@/shared/services/effects';
import { useShallow } from 'zustand/react/shallow';
import { CanvasSessionSelector } from '@/widgets/session-tabs/CanvasBreadcrumb';

import { AppMenu } from '@/widgets/toolbar/app-menu';
import { getStaticGridViewState } from '@/domains/selection/public';
import { isStaticGridMode } from '@/domains/sessions/public';
import { useGlobalShortcutCommands } from './useGlobalShortcutCommands';
import { ZoomControl } from '@/widgets/toolbar/zoom-control';
import { SecurityControl } from '@/widgets/toolbar/security-control';
import { ShortcutProvider } from '@/shared/shortcuts/dispatcher';
import { useActiveCollaboration } from './useActiveCollaboration';
import { useHorizontalWheelNavigationGuard } from './useHorizontalWheelNavigationGuard';
import { CollaborationControl } from '@/widgets/collaboration/CollaborationControl';
import { RemotePresenceOverlay } from '@/widgets/collaboration/RemotePresenceOverlay';
import { useCollaborationSnapshot } from '@/widgets/collaboration/useCollaborationSnapshot';
import { sameCollaborationRoom } from '@/domains/collaboration/public';
import { OnboardingTourProvider } from '@/widgets/onboarding/new-user-tour';
import {
  CanvasViewProvider,
  CanvasWorkspaceProvider,
  useActiveCanvasView,
  useCanvasViewOptional,
  useCanvasWorkspace,
  type CanvasViewId,
} from '@/widgets/canvas-editor/engine/CanvasWorkspace';
import { useEditor } from '@/domains/editor/public';



import { CanvasInspectorControl } from '@/widgets/canvas-inspector';
import {
  EditorChromeLayout,
  EditorChromeProvider,
  EditorPresentationProvider,
  EditorWidget,
  resolvePaneViewportFrame,
  useEditorChromeLayout,
  useEditorPresentation,
} from '@/widgets/editor-chrome/public';
import { intersectHostCapabilities } from './editorHostProfile';
import { useEditorHostProfile } from './useEditorHostProfile';
import { useBlackboardSource } from './useBlackboardSource';
import { getAppActionShortcuts } from '@/domains/actions/public';

import type { CanvasEditorCapabilities } from '@/widgets/canvas-editor/canvasEditorCapabilities';
import type { EditorViewportFrame } from '@/widgets/editor-chrome/public';
import { useUiI18n } from '@/shared/i18n';
import { RecoverableLazyBoundary } from './RecoverableLazyBoundary';
import { requireLoadedModule } from './moduleLoadRecovery';


const SidebarRight = lazy(() =>
  import('@/widgets/toolbar/sidebar-right').then((loaded) => ({
    default: requireLoadedModule(loaded).SidebarRight,
  }))
);

const getBlackboardStatusTone = (
  state: ReturnType<typeof useBlackboardSource>['status']['state']
): StatusTone => {
  switch (state) {
    case 'current':
      return 'success';
    case 'warning':
    case 'missing':
      return 'warning';
    case 'disconnected':
      return 'error';
    default:
      return 'neutral';
  }
};

function SidebarShortcutRegistration() {
  const { toggleSidebar } = useSidebar();
  const editor = useEditor();
  useEffect(() => {
    const disposeCommand = editor.commands.register('app.chrome', {
      id: 'ui.toggle-sidebar',
      execute: () => {
        toggleSidebar();
        return { handled: true, status: 'succeeded' };
      },
    });
    const disposeBinding = editor.keymap.register('app.chrome', {
      id: 'command:toggle-sidebar',
      label: 'Toggle Sidebar',
      category: 'Canvas',
      scope: 'application',
      shortcuts: getAppActionShortcuts('toggle-sidebar'),
      target: { type: 'command', id: 'ui.toggle-sidebar' },
      when: ({ targetKind }) => targetKind !== 'editable' && targetKind !== 'overlay',
    });
    return () => {
      disposeBinding();
      disposeCommand();
    };
  }, [editor, toggleSidebar]);
  return null;
}

function PhoneSidebarTrigger() {
  const { openMobile } = useSidebar();
  const { t } = useUiI18n();
  if (openMobile) return null;
  return <SidebarTrigger side="right" aria-label={t('sidebar.toggle')} />;
}

function SplitViewCommandRegistration() {
  const editor = useEditor();
  const { splitEnabled, setSplitEnabled } = useCanvasWorkspace();
  useEffect(() => editor.commands.register('app.chrome', {
    id: 'ui.toggle-split-view',
    execute: () => {
      setSplitEnabled(!splitEnabled);
      return { handled: true, status: 'succeeded' };
    },
  }), [editor, setSplitEnabled, splitEnabled]);
  return null;
}

type CanvasPaneProps = {
  viewId: CanvasViewId;
  onUndo: () => void;
  onRedo: () => void;
  capabilities: CanvasEditorCapabilities;
  fitContentRevision: number;
  viewportFrame?: EditorViewportFrame;
  collaborate: boolean;
  split: boolean;
  manageSessions: boolean;
};

function BoundCanvasSessionSelector({
  manageSessions,
  onboardingTarget = false,
  showPaneActivity = false,
}: {
  manageSessions: boolean;
  onboardingTarget?: boolean;
  showPaneActivity?: boolean;
}) {
  const view = useCanvasViewOptional();
  if (!view) return null;
  return (
    <CanvasSessionSelector
      manageSessions={manageSessions}
      selectedSessionId={view.sessionId}
      onSelectSession={view.selectSession}
      onActivate={view.activate}
      onboardingTarget={onboardingTarget}
      paneActive={showPaneActivity && view.isActive}
    />
  );
}

function HostedCanvasSessionSelector({
  viewId,
  manageSessions,
  showPaneActivity,
}: {
  viewId: CanvasViewId;
  manageSessions: boolean;
  showPaneActivity: boolean;
}) {
  return (
    <CanvasViewProvider viewId={viewId}>
      <div
        data-canvas-ui="true"
        data-testid={`canvas-session-selector-${viewId}`}
        className="pointer-events-auto min-w-0 max-w-[min(14rem,calc(100vw-7.75rem))]"
      >
        <BoundCanvasSessionSelector
          manageSessions={manageSessions}
          onboardingTarget
          showPaneActivity={showPaneActivity}
        />
      </div>
    </CanvasViewProvider>
  );
}

function CanvasPaneContent({
  onUndo,
  onRedo,
  capabilities,
  fitContentRevision,
  viewportFrame,
  collaborate,
  split,
  manageSessions,
}: Omit<CanvasPaneProps, 'viewId'>) {
  const view = useCanvasViewOptional();
  const { t } = useUiI18n();
  if (!view) return null;
  const paneViewportFrame = viewportFrame && view.containerSize
    ? resolvePaneViewportFrame(
        viewportFrame,
        view.containerSize,
        split ? (view.viewId === 'primary' ? 'start' : 'end') : 'single'
      )
    : viewportFrame;
  return (
    <div
      data-testid={`canvas-view-${view.viewId}`}
      data-active={view.isActive ? 'true' : 'false'}
      data-session-id={view.sessionId ?? undefined}
      aria-label={
        view.viewId === 'primary' ? t('canvasView.primary') : t('canvasView.secondary')
      }
      className="relative size-full overflow-hidden"
    >
      <CanvasEditor
        onUndo={onUndo}
        onRedo={onRedo}
        capabilities={capabilities}
        fitContentRevision={fitContentRevision}
        viewportFrame={paneViewportFrame}
        active={view.isActive}
        onActivate={view.activate}
        onContainerSizeChange={view.setContainerSize}
      />
      {split && view.viewId === 'secondary' ? (
        <EditorWidget role="pane">
          <div
            data-canvas-ui="true"
            data-testid="canvas-session-selector-secondary"
            className="pointer-events-auto absolute left-(--editor-chrome-inset) top-(--editor-safe-top) z-(--layer-controls) max-w-[min(14rem,calc(100%-1rem))]"
          >
            <BoundCanvasSessionSelector
              manageSessions={manageSessions}
              showPaneActivity
            />
          </div>
        </EditorWidget>
      ) : null}
      {collaborate && view.isActive && <RemotePresenceOverlay />}
    </div>
  );
}

function CanvasPane({ viewId, ...props }: CanvasPaneProps) {
  return (
    <CanvasViewProvider viewId={viewId}>
      <CanvasPaneContent {...props} />
    </CanvasViewProvider>
  );
}

function CanvasWorkspaceSurface({
  renderSplit,
  ...props
}: Omit<CanvasPaneProps, 'viewId' | 'split'> & { renderSplit: boolean }) {
  const workspace = useCanvasWorkspace();
  const activeView = useActiveCanvasView();
  const { t } = useUiI18n();

  return (
    <div
      data-onboarding-target="workspace"
      data-split-view={renderSplit ? 'true' : 'false'}
      className="relative size-full overflow-hidden"
    >
      {renderSplit ? (
        <ResizablePanelGroup
          id="canvas-split-view"
          orientation="horizontal"
          defaultLayout={{
            primary: workspace.splitRatio,
            secondary: 100 - workspace.splitRatio,
          }}
          resizeTargetMinimumSize={{ fine: 8, coarse: 24 }}
          onLayoutChanged={(layout, meta) => {
            if (meta.isUserInteraction && layout.primary != null) {
              workspace.setSplitRatio(layout.primary);
            }
          }}
        >
          <ResizablePanel id="primary" minSize="320px">
            <CanvasPane viewId="primary" split {...props} />
          </ResizablePanel>
          <ResizableHandle aria-label={t('canvasView.resize')} />
          <ResizablePanel id="secondary" minSize="320px">
            <CanvasPane viewId="secondary" split {...props} />
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <CanvasPane viewId={activeView.viewId} split={false} {...props} />
      )}
    </div>
  );
}

function AppContent() {
  const hostProfile = useEditorHostProfile();
  useActiveCollaboration({ enabled: hostProfile.capabilities.collaborate });
  useHorizontalWheelNavigationGuard();
  const collaborationSnapshot = useCollaborationSnapshot();
  const persistence = useCanvasPersistence();
  const activeCollaboration = useCanvasState(
    (state) =>
      state.canvasSessions.find((session) => session.id === state.activeCanvasId)?.collaboration
  );
  const isCollaborationReadOnly =
    !!activeCollaboration &&
    (!collaborationSnapshot.canEdit ||
      !sameCollaborationRoom(activeCollaboration, collaborationSnapshot.descriptor));
  const capabilities = intersectHostCapabilities(
    hostProfile.capabilities,
    !isCollaborationReadOnly && persistence.ownership === 'writer'
  );
  const blackboardSource = useBlackboardSource({
    enabled: hostProfile.id === 'blackboard',
  });
  const { formFactor, sidebarPresentation, viewportFrame } = useEditorChromeLayout();
  const { mode, isWidgetVisible } = useEditorPresentation();
  const zenMode = mode === 'zen';
  const showHostWidgets = isWidgetVisible('host');
  const workspace = useCanvasWorkspace();
  const activeView = useActiveCanvasView();
  const renderSplit =
    workspace.splitEnabled && (viewportFrame.width === 0 || viewportFrame.width >= 640);
  const hostedSelectorViewId: CanvasViewId = renderSplit ? 'primary' : activeView.viewId;
  const {
    tool,
    canvasMode,
    textCursor,
    staticGridSelection,
    staticGridEditMode,
    grid,
    editingStructuredTextNodeId,
    structuredTextSelection,
  } = useCanvasState(
    useShallow((state) => ({
      tool: state.tool,
      canvasMode: state.canvasMode,
      textCursor: state.textCursor,
      staticGridSelection: state.staticGridSelection,
      staticGridEditMode: state.staticGridEditMode,
      grid: state.grid,
      editingStructuredTextNodeId: state.editingStructuredTextNodeId,
      structuredTextSelection: state.structuredTextSelection,
    }))
  );
  const editor = useEditor();
  const canvas = useCanvasRuntime();
  const setTool = useCallback(
    (nextTool: typeof tool) => {
      editor.setCurrentTool(nextTool);
    },
    [editor]
  );
  const exitStaticGridTextEdit = canvas.commands.staticGrid.exitTextEdit;
  const setTextCursor = canvas.commands.interaction.setTextCursor;
  const setEditingStructuredTextNodeId = canvas.commands.interaction.setEditingStructuredTextNodeId;
  const setStructuredTextSelection = canvas.commands.interaction.setStructuredTextSelection;
  const staticGridView = useMemo(
    () =>
      getStaticGridViewState({
        selection: staticGridSelection,
        editMode: staticGridEditMode,
        textCursor,
        grid,
      }),
    [grid, staticGridEditMode, staticGridSelection, textCursor]
  );
  const isCanvasTextEditing = isStaticGridMode(canvasMode)
    ? !!staticGridView.textCursor
    : !!textCursor || !!editingStructuredTextNodeId || !!structuredTextSelection;
  const exitCanvasTextEditing = useCallback(() => {
    exitStaticGridTextEdit();
    setTextCursor(null);
    setEditingStructuredTextNodeId(null);
    setStructuredTextSelection(null);
  }, [
    exitStaticGridTextEdit,
    setEditingStructuredTextNodeId,
    setStructuredTextSelection,
    setTextCursor,
  ]);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useLocalStorageState<boolean>(
    'ui-right-panel-status',
    { defaultValue: true }
  );
  const [transientSidebar, setTransientSidebar] = useState({
    formFactor,
    open: false,
  });
  const transientSidebarOpen = transientSidebar.formFactor === formFactor && transientSidebar.open;

  const isRightPanelOpen =
    formFactor === 'desktop' ? (desktopSidebarOpen ?? true) : transientSidebarOpen;
  const setIsRightPanelOpen = useCallback(
    (open: boolean) => {
      if (formFactor === 'desktop') setDesktopSidebarOpen(open);
      else setTransientSidebar({ formFactor, open });
    },
    [formFactor, setDesktopSidebarOpen, setTransientSidebar]
  );

  const handleUndo = () => {
    const changed = editor.history.undo();
    if (changed) feedback.dismiss();
    return changed;
  };

  const handleRedo = () => {
    return editor.history.redo();
  };

  useGlobalShortcutCommands({
    enabled: capabilities.mutateContent,
  });

  return (
    <SidebarProvider
      presentation={sidebarPresentation}
      open={isRightPanelOpen}
      onOpenChange={setIsRightPanelOpen}
      className="size-full overflow-hidden"
    >
      <SidebarShortcutRegistration />
      <SplitViewCommandRegistration />
      <EditorChromeLayout
        sidebarOpen={showHostWidgets && isRightPanelOpen}
        topStart={
          <div
            data-canvas-ui="true"
            data-testid="app-top-bar"
            data-zen-mode={zenMode ? 'true' : 'false'}
            className="flex min-w-0 items-center gap-1 pointer-events-none"
          >
            <div data-testid="app-primary-control-stack" className="relative size-8 flex-none">
              <div inert={!capabilities.manageSessions || undefined}>
                <EditorWidget role="essential">
                  <AppMenu />
                </EditorWidget>
              </div>
              <EditorWidget role="host">
                <div
                  data-testid="canvas-properties-control-position"
                  className="pointer-events-auto absolute left-0 top-9"
                >
                  <CanvasInspectorControl
                    formFactor={formFactor}
                    readOnly={!capabilities.mutateContent}
                  />
                </div>
              </EditorWidget>
            </div>
            <EditorWidget role="host">
              <HostedCanvasSessionSelector
                viewId={hostedSelectorViewId}
                manageSessions={capabilities.manageSessions}
                showPaneActivity={renderSplit}
              />
            </EditorWidget>
            {showHostWidgets && hostProfile.id === 'blackboard' && (
              <StatusText tone={getBlackboardStatusTone(blackboardSource.status.state)} asChild>
                <span
                  data-testid="blackboard-source-status"
                  data-state={blackboardSource.status.state}
                  className="pointer-events-auto truncate px-2 text-xs"
                >
                  {blackboardSource.status.message}
                </span>
              </StatusText>
            )}
            {showHostWidgets && capabilities.collaborate && (
              <div className="flex-none">
                <CollaborationControl />
              </div>
            )}
          </div>
        }
        topEnd={showHostWidgets && formFactor === 'phone' ? <PhoneSidebarTrigger /> : null}
        bottomStart={
          !showHostWidgets || formFactor === 'phone' ? null : (
            <ZoomControl viewportFrame={viewportFrame} formFactor={formFactor} />
          )
        }
        bottomCenter={!showHostWidgets ? null : (
          <div aria-disabled={!capabilities.mutateContent}>
            <Toolbar
              tool={tool}
              setTool={setTool}
              onUndo={handleUndo}
              isCanvasTextEditing={isCanvasTextEditing}
              onExitCanvasTextEditing={exitCanvasTextEditing}
              enabled={capabilities.navigate || capabilities.select}
              mutateContent={capabilities.mutateContent}
              formFactor={formFactor}
            />
          </div>
        )}
        bottomEnd={!showHostWidgets ? null : <SecurityControl />}
        sidebar={!showHostWidgets ? null : (
          <RecoverableLazyBoundary
            resetKey={isRightPanelOpen}
            onError={() => setIsRightPanelOpen(false)}
          >
            <Suspense fallback={null}>
              <div
                className="size-full min-h-0 overflow-visible"
                inert={!capabilities.mutateContent || undefined}
              >
                <SidebarRight />
              </div>
            </Suspense>
          </RecoverableLazyBoundary>
        )}
        canvas={
          <CanvasWorkspaceSurface
            onUndo={handleUndo}
            onRedo={handleRedo}
            capabilities={capabilities}
            fitContentRevision={blackboardSource.firstFitRevision}
            viewportFrame={viewportFrame}
            collaborate={capabilities.collaborate}
            manageSessions={capabilities.manageSessions}
            renderSplit={renderSplit}
          />
        }
      />
      <Toaster />
    </SidebarProvider>
  );
}

export default function App() {
  const { t } = useUiI18n();
  const uiMessages = useMemo(
    () => ({
      dialogClose: t('dialog.close'),
      notificationRegion: t('notification.region'),
      sidebarTitle: t('sidebar.title'),
      sidebarMobileDescription: t('sidebar.mobileDescription'),
      sidebarToggle: t('sidebar.toggle'),
    }),
    [t]
  );

  return (
    <UiProvider messages={uiMessages}>
      <ShortcutProvider>
        <TooltipProvider>
          <OnboardingTourProvider>
            <EditorPresentationProvider>
              <CanvasWorkspaceProvider>
                <EditorChromeProvider>
                  <AppContent />
                </EditorChromeProvider>
              </CanvasWorkspaceProvider>
            </EditorPresentationProvider>
          </OnboardingTourProvider>
        </TooltipProvider>
      </ShortcutProvider>
    </UiProvider>
  );
}
