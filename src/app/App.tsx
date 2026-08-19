import { useLocalStorageState } from 'ahooks';
import { CanvasEditor } from '@/widgets/canvas-editor';
import { useCanvasRuntime, useCanvasState } from '@/domains/canvas/public';
import { Toolbar } from '@/widgets/toolbar/dock';
import { SidebarProvider, SidebarTrigger, useSidebar } from '@/shared/ui/sidebar';
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { feedback } from '@/shared/services/effects';
import { useShallow } from 'zustand/react/shallow';
import { CanvasBreadcrumb } from '@/widgets/session-tabs/CanvasBreadcrumb';
import { TooltipProvider } from '@/shared/ui/tooltip';
import { AppMenu } from '@/widgets/toolbar/app-menu';
import { getStaticGridViewState } from '@/domains/selection/public';
import { isStaticGridMode } from '@/domains/sessions/public';
import { useGlobalShortcutCommands } from './useGlobalShortcutCommands';
import { ZoomControl } from '@/widgets/toolbar/zoom-control';
import { HelpControl } from '@/widgets/toolbar/help-control';
import { ShortcutProvider } from '@/shared/shortcuts/dispatcher';
import { useActiveCollaboration } from './useActiveCollaboration';
import { useHorizontalWheelNavigationGuard } from './useHorizontalWheelNavigationGuard';
import { CollaborationControl } from '@/widgets/collaboration/CollaborationControl';
import { RemotePresenceOverlay } from '@/widgets/collaboration/RemotePresenceOverlay';
import { useCollaborationSnapshot } from '@/widgets/collaboration/useCollaborationSnapshot';
import { sameCollaborationRoom } from '@/domains/collaboration/public';
import { OnboardingTourProvider } from '@/widgets/onboarding/new-user-tour';
import { CanvasEngineProvider } from '@/widgets/canvas-editor/engine/useCanvasEngineRuntime';
import { useEditor } from '@/domains/editor/public';
import { Toaster } from '@/shared/ui/sonner';
import { CanvasInspectorControl } from '@/widgets/canvas-inspector';
import {
  EditorChromeLayout,
  EditorChromeProvider,
  useEditorChromeLayout,
} from '@/widgets/editor-chrome/public';
import { intersectHostCapabilities } from './editorHostProfile';
import { useEditorHostProfile } from './useEditorHostProfile';
import { useBlackboardSource } from './useBlackboardSource';
import { getAppActionShortcuts } from '@/domains/actions/public';

const SidebarRight = lazy(() =>
  import('@/widgets/toolbar/sidebar-right').then((module) => ({
    default: module.SidebarRight,
  }))
);

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
  if (openMobile) return null;
  return <SidebarTrigger side="right" />;
}

function AppContent() {
  const hostProfile = useEditorHostProfile();
  useActiveCollaboration({ enabled: hostProfile.capabilities.collaborate });
  useHorizontalWheelNavigationGuard();
  const collaborationSnapshot = useCollaborationSnapshot();
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
    !isCollaborationReadOnly
  );
  const blackboardSource = useBlackboardSource({
    enabled: hostProfile.id === 'blackboard',
  });
  const { formFactor, sidebarPresentation, viewportFrame } = useEditorChromeLayout();
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
      <EditorChromeLayout
        sidebarOpen={isRightPanelOpen}
        topStart={
          <div
            data-canvas-ui="true"
            data-testid="app-top-bar"
            className="flex min-w-0 items-center gap-1 pointer-events-none"
          >
            <div data-testid="app-primary-control-stack" className="relative size-8 flex-none">
              <div inert={!capabilities.manageSessions || undefined}>
                <AppMenu />
              </div>
              <div
                data-testid="canvas-properties-control-position"
                className="pointer-events-auto absolute left-0 top-9"
              >
                <CanvasInspectorControl
                  formFactor={formFactor}
                  readOnly={!capabilities.mutateContent}
                />
              </div>
            </div>
            <CanvasBreadcrumb manageSessions={capabilities.manageSessions} />
            {hostProfile.id === 'blackboard' && (
              <span
                data-testid="blackboard-source-status"
                data-state={blackboardSource.status.state}
                className="pointer-events-auto truncate px-2 text-xs text-muted-foreground"
              >
                {blackboardSource.status.message}
              </span>
            )}
            {capabilities.collaborate && <CollaborationControl />}
          </div>
        }
        topEnd={formFactor === 'phone' ? <PhoneSidebarTrigger /> : null}
        bottomStart={
          formFactor === 'phone' ? null : (
            <ZoomControl viewportFrame={viewportFrame} formFactor={formFactor} />
          )
        }
        bottomCenter={
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
        }
        bottomEnd={<HelpControl />}
        sidebar={
          <Suspense fallback={null}>
            <div
              className="size-full min-h-0 overflow-visible"
              inert={!capabilities.mutateContent || undefined}
            >
              <SidebarRight />
            </div>
          </Suspense>
        }
        canvas={
          <div data-onboarding-target="workspace" className="relative size-full overflow-hidden">
            <div className="relative h-full w-full">
              <CanvasEditor
                onUndo={handleUndo}
                onRedo={handleRedo}
                capabilities={capabilities}
                fitContentRevision={blackboardSource.firstFitRevision}
                viewportFrame={viewportFrame}
              />
              {capabilities.collaborate && <RemotePresenceOverlay />}
            </div>
          </div>
        }
      />
      <Toaster />
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <ShortcutProvider>
      <TooltipProvider>
        <OnboardingTourProvider>
          <CanvasEngineProvider>
            <EditorChromeProvider>
              <AppContent />
            </EditorChromeProvider>
          </CanvasEngineProvider>
        </OnboardingTourProvider>
      </TooltipProvider>
    </ShortcutProvider>
  );
}
