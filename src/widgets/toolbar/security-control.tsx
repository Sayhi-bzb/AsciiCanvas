'use client';

import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { useUiI18n } from '@/shared/i18n';
import { HOST_ICONOLOGY } from '@/shared/icons/iconology';
import {
  Button,
  Tooltip,
  TooltipCreateHandle,
  TooltipPopup,
  TooltipTrigger,
} from '@chardesk/ui';
import { RecoverableLazyBoundary } from '@/shared/components/RecoverableLazyBoundary';
import { requireLoadedModule } from '@/shared/lib/moduleLoadRecovery';
import { useCanvasPersistence } from '@/domains/canvas/public';

const SecurityIcon = HOST_ICONOLOGY.viewportAction.security;
const DataSecurityDialog = lazy(() =>
  import('@/widgets/dialogs/data-security-dialog').then((loaded) => ({
    default: requireLoadedModule(loaded).DataSecurityDialog,
  }))
);

export function SecurityControl() {
  const { t } = useUiI18n();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipHandle = useMemo(() => TooltipCreateHandle<string>(), []);
  const label = t('security.title');
  const persistence = useCanvasPersistence();

  return (
    <>
      <div
        data-canvas-ui="true"
        data-testid="security-control-host"
        className="pointer-events-auto relative"
        data-persistence-state={persistence.save}
      >
        <TooltipTrigger
          handle={tooltipHandle}
          payload={label}
          render={
            <Button
              ref={triggerRef}
              tone="subtle"
              shape="square"
              size="md"
              open={open}
              aria-label={label}
              data-testid="data-security-control"
              onClick={() => setOpen(true)}
            />
          }
        >
          <SecurityIcon />
        </TooltipTrigger>
        {(persistence.save === 'error' || persistence.ownership === 'reader') && (
          <span
            aria-label={persistence.ownership === 'reader'
              ? t('security.persistence.reader')
              : t('security.persistence.unsaved')}
            className={persistence.ownership === 'reader'
              ? 'pointer-events-none absolute right-0 top-0 size-2 rounded-full bg-warning'
              : 'pointer-events-none absolute right-0 top-0 size-2 rounded-full bg-destructive'}
          />
        )}
        <Tooltip handle={tooltipHandle}>
          {({ payload }) => <TooltipPopup side="bottom">{payload}</TooltipPopup>}
        </Tooltip>
      </div>

      <RecoverableLazyBoundary resetKey={open} onError={() => setOpen(false)}>
        <Suspense fallback={null}>
          {open && (
            <DataSecurityDialog
              open={open}
              onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (!nextOpen) {
                  window.setTimeout(() => triggerRef.current?.focus(), 0);
                }
              }}
            />
          )}
        </Suspense>
      </RecoverableLazyBoundary>
    </>
  );
}
