'use client';

import { lazy, Suspense, useRef, useState } from 'react';
import { useUiI18n } from '@/shared/i18n';
import { HOST_ICONOLOGY } from '@/shared/icons/iconology';
import { cn } from '@/shared/lib/utils';
import { uiClass } from '@/shared/styles/components';
import { Button } from '@/shared/ui/button';
import { useSidebar } from '@/shared/ui/sidebar';

const HelpIcon = HOST_ICONOLOGY.viewportAction.help;
const HandbookDialog = lazy(() =>
  import('@/widgets/dialogs/handbook-dialog').then((module) => ({
    default: module.HandbookDialog,
  }))
);

export function HelpControl() {
  const { isMobile, openMobile } = useSidebar();
  const { t } = useUiI18n();
  const [handbookOpen, setHandbookOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const label = t('manual.title');

  return (
    <>
      {(!isMobile || !openMobile) && (
        <div
          data-canvas-ui="true"
          data-testid="help-control-host"
          className="fixed bottom-3 right-3 z-50 pointer-events-auto"
        >
          <Button
            ref={triggerRef}
            tone="subtle"
            shape="square"
            size="md"
            className={cn(
              uiClass.hostIconControl,
              handbookOpen && uiClass.hostControlActive
            )}
            aria-label={label}
            aria-pressed={handbookOpen}
            title={label}
            data-testid="help-control"
            onClick={() => setHandbookOpen(true)}
          >
            <HelpIcon />
          </Button>
        </div>
      )}

      <Suspense fallback={null}>
        {handbookOpen && (
          <HandbookDialog
            open={handbookOpen}
            onOpenChange={(open) => {
              setHandbookOpen(open);
              if (!open) queueMicrotask(() => triggerRef.current?.focus());
            }}
            trigger={null}
          />
        )}
      </Suspense>
    </>
  );
}
