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

const SecurityIcon = HOST_ICONOLOGY.viewportAction.security;
const DataSecurityDialog = lazy(() =>
  import('@/widgets/dialogs/data-security-dialog').then((module) => ({
    default: module.DataSecurityDialog,
  }))
);

export function SecurityControl() {
  const { t } = useUiI18n();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipHandle = useMemo(() => TooltipCreateHandle<string>(), []);
  const label = t('security.title');

  return (
    <>
      <div
        data-canvas-ui="true"
        data-testid="security-control-host"
        className="pointer-events-auto"
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
        <Tooltip handle={tooltipHandle}>
          {({ payload }) => <TooltipPopup side="bottom">{payload}</TooltipPopup>}
        </Tooltip>
      </div>

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
    </>
  );
}
