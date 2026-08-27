import { useEffect, useState } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Spinner,
} from "@chardesk/ui";

const LOADING_FEEDBACK_DELAY = 150;

export function ModuleLoadingScreen() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), LOADING_FEEDBACK_DELAY);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
      {visible ? <Spinner /> : null}
    </main>
  );
}

export function ModuleLoadFailure({ onReload }: { onReload: () => void }) {
  return (
    <main className="flex min-h-dvh bg-background p-6 text-foreground">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertTriangle />
          </EmptyMedia>
          <EmptyTitle>Unable to load CharDesk</EmptyTitle>
          <EmptyDescription>
            The interface changed or its cache expired. Reload to try again.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button type="button" onClick={onReload}>
            <RotateCw data-icon="inline-start" />
            Reload
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
