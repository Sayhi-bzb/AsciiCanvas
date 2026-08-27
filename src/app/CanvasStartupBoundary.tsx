import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
  Button,
  Skeleton,
  Spinner,
  StatusText,
  Surface,
} from "@chardesk/ui";
import {
  useCanvasPersistence,
  useCanvasRuntime,
} from "@/domains/canvas/public";
import { useUiI18n } from "@/shared/i18n";
import { EditorChromeLayout } from "@/widgets/editor-chrome/public";

const LOADING_FEEDBACK_DELAY = 150;

function useDelayedLoadingFeedback() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), LOADING_FEEDBACK_DELAY);
    return () => window.clearTimeout(timer);
  }, []);
  return visible;
}

function RestoringWorkspaceShell() {
  const { t } = useUiI18n();
  const showFeedback = useDelayedLoadingFeedback();
  return (
    <EditorChromeLayout
      sidebarOpen={false}
      topStart={(
        <div
          data-canvas-ui="true"
          data-testid="startup-chrome"
          className="flex min-w-0 items-center gap-1"
        >
          <Skeleton aria-hidden="true" className="size-8 flex-none" />
          <Skeleton aria-hidden="true" className="h-6 w-28" />
        </div>
      )}
      canvas={(
        <Surface
          kind="embedded"
          data-testid="canvas-restore-surface"
          aria-busy="true"
          aria-label={t("startup.restoring")}
          className="flex size-full items-center justify-center"
        >
          {showFeedback ? (
            <div role="status" aria-live="polite" className="flex items-center gap-2">
              <Spinner aria-hidden="true" />
              <StatusText tone="neutral">{t("startup.restoring")}</StatusText>
            </div>
          ) : null}
        </Surface>
      )}
    />
  );
}

function TemporaryWorkspaceAlert({
  retrying,
  onRetry,
}: {
  retrying: boolean;
  onRetry: () => void;
}) {
  const { t } = useUiI18n();
  return (
    <div
      data-canvas-ui="true"
      data-testid="temporary-canvas-alert"
      className="pointer-events-auto absolute left-1/2 top-(--editor-safe-top) z-(--layer-controls) w-[min(28rem,calc(100%-2rem))] -translate-x-1/2"
    >
      <Alert>
        <AlertTriangle aria-hidden="true" />
        <AlertTitle>{t("startup.temporaryTitle")}</AlertTitle>
        <AlertDescription>
          {t("startup.temporaryDescription")}
        </AlertDescription>
        <AlertAction>
          <Button
            type="button"
            tone="subtle"
            size="sm"
            outlined
            disabled={retrying}
            onClick={onRetry}
          >
            {retrying ? (
              <Spinner aria-hidden="true" data-icon="inline-start" />
            ) : (
              <RefreshCcw data-icon="inline-start" />
            )}
            {t(retrying ? "startup.retrying" : "startup.retry")}
          </Button>
        </AlertAction>
      </Alert>
    </div>
  );
}

export function CanvasStartupBoundary({ children }: { children: ReactNode }) {
  const canvas = useCanvasRuntime();
  const persistence = useCanvasPersistence();
  const restorePhase = persistence.restore.phase;
  if (restorePhase === "initializing") return <RestoringWorkspaceShell />;

  const retrying = restorePhase === "retrying";
  const temporary = restorePhase === "temporary" || retrying;
  return (
    <div
      data-testid="canvas-runtime-shell"
      data-restore-phase={restorePhase}
      aria-busy={retrying || undefined}
      className="relative size-full"
    >
      <div className="size-full" inert={retrying || undefined}>
        {children}
      </div>
      {temporary ? (
        <TemporaryWorkspaceAlert
          retrying={retrying}
          onRetry={() => void canvas.retryRestore()}
        />
      ) : null}
    </div>
  );
}
