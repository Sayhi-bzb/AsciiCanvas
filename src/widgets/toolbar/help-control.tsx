'use client';

import { lazy, Suspense, useRef, useState } from 'react';
import { useUiI18n } from '@/shared/i18n';
import { HOST_ICONOLOGY } from '@/shared/icons/iconology';
import { Button } from '@/shared/ui/button';
import { useOnboardingTour } from '@/widgets/onboarding/onboarding-context';

const HelpIcon = HOST_ICONOLOGY.viewportAction.help;
const SecurityIcon = HOST_ICONOLOGY.viewportAction.security;
const DataSecurityDialog = lazy(() =>
  import('@/widgets/dialogs/data-security-dialog').then((module) => ({
    default: module.DataSecurityDialog,
  }))
);
const HandbookDialog = lazy(() =>
  import('@/widgets/dialogs/handbook-dialog').then((module) => ({
    default: module.HandbookDialog,
  }))
);

export function HelpControl() {
  const { t } = useUiI18n();
  const { canStart: canStartTour, requestStart: requestTourStart } =
    useOnboardingTour();
  const [securityOpen, setSecurityOpen] = useState(false);
  const [handbookOpen, setHandbookOpen] = useState(false);
  const securityTriggerRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const label = t('manual.title');
  const securityLabel = t('security.title');
  const startTour = () => {
    setHandbookOpen(false);
    window.setTimeout(requestTourStart, 0);
  };

  return (
    <>
      <div
        data-canvas-ui="true"
        data-testid="help-control-host"
        className="flex items-center gap-1 pointer-events-auto"
      >
          <Button
            ref={securityTriggerRef}
            tone="subtle"
            shape="square"
            size="md"
            open={securityOpen}
            aria-label={securityLabel}
            title={securityLabel}
            data-testid="data-security-control"
            onClick={() => setSecurityOpen(true)}
          >
            <SecurityIcon />
          </Button>
          <Button
            ref={triggerRef}
            tone="subtle"
            shape="square"
            size="md"
            open={handbookOpen}
            aria-label={label}
            title={label}
            data-testid="help-control"
            onClick={() => setHandbookOpen(true)}
          >
            <HelpIcon />
          </Button>
      </div>

      <Suspense fallback={null}>
        {securityOpen && (
          <DataSecurityDialog
            open={securityOpen}
            onOpenChange={(open) => {
              setSecurityOpen(open);
              if (!open) setTimeout(() => securityTriggerRef.current?.focus(), 0);
            }}
          />
        )}
        {handbookOpen && (
          <HandbookDialog
            open={handbookOpen}
            onOpenChange={(open) => {
              setHandbookOpen(open);
              if (!open) setTimeout(() => triggerRef.current?.focus(), 0);
            }}
            trigger={null}
            onStartTour={canStartTour ? startTour : undefined}
          />
        )}
      </Suspense>
    </>
  );
}
