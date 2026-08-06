'use client';

import { useEffect, useMemo, useState } from 'react';
import { useEditorStore } from '@/domains/canvas/public';
import {
  buildCollaborationUrl,
  collaborationRuntime,
  createCollaborationDescriptor,
  parseCollaborationUrl,
  sameCollaborationRoom,
  validateCollaborationEndpoint,
} from '@/domains/collaboration/public';
import { useCollaborationSnapshot } from './useCollaborationSnapshot';
import { HOST_ICONOLOGY } from '@/shared/icons/iconology';
import { useUiI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { feedback } from '@/shared/services/effects';
import { uiClass } from '@/shared/styles/components';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Input } from '@/shared/ui/input';

const CollaborationIcon = HOST_ICONOLOGY.sessionAction.collaboration;
const STATUS_KEYS = {
  idle: 'collaboration.status.idle',
  'loading-local': 'collaboration.status.loading-local',
  connecting: 'collaboration.status.connecting',
  'waiting-for-peer': 'collaboration.status.waiting-for-peer',
  connected: 'collaboration.status.connected',
  offline: 'collaboration.status.offline',
  error: 'collaboration.status.error',
} as const;

export function CollaborationControl() {
  const { t } = useUiI18n();
  const [open, setOpen] = useState(false);
  const [endpoint, setEndpoint] = useState('');
  const snapshot = useCollaborationSnapshot();
  const activeSession = useEditorStore((state) =>
    state.canvasSessions.find((session) => session.id === state.activeCanvasId)
  );
  const setCollaboration = useEditorStore((state) => state.setCanvasSessionCollaboration);
  const descriptor = activeSession?.collaboration;

  useEffect(() => {
    const incoming = parseCollaborationUrl();
    if (!incoming || !activeSession || activeSession.mode === "slide") return;
    if (!sameCollaborationRoom(activeSession.collaboration, incoming)) {
      setCollaboration(activeSession.id, incoming, { resetDocument: true });
    }
  }, [activeSession, setCollaboration]);

  useEffect(() => {
    if (!open) return;
    const closeOnWindowBlur = () => setOpen(false);
    window.addEventListener('blur', closeOnWindowBlur);
    return () => window.removeEventListener('blur', closeOnWindowBlur);
  }, [open]);

  const statusLabel = useMemo(() => t(STATUS_KEYS[snapshot.status]), [snapshot.status, t]);

  const start = (customEndpoint?: string) => {
    if (!activeSession || activeSession.mode === "slide") return;
    try {
      const next = createCollaborationDescriptor(customEndpoint);
      setCollaboration(activeSession.id, next);
      window.history.replaceState(null, '', buildCollaborationUrl(next));
    } catch {
      feedback.error(t('collaboration.endpoint.invalid'));
    }
  };

  const copyLink = async () => {
    if (!descriptor) return;
    await navigator.clipboard.writeText(buildCollaborationUrl(descriptor));
    feedback.success(t('collaboration.link.copied'));
  };

  const leave = () => {
    if (!activeSession) return;
    setCollaboration(activeSession.id, null);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  };

  const forget = async () => {
    if (!descriptor) return;
    await collaborationRuntime.forget(descriptor);
    leave();
  };

  const normalizedEndpoint = validateCollaborationEndpoint(endpoint);
  const keepOpen = (event: Event) => event.preventDefault();

  if (activeSession?.mode === "slide") return null;

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          tone="subtle"
          shape="square"
          size="md"
          className={cn(
            'pointer-events-auto',
            uiClass.hostIconControl,
            (open || descriptor) && uiClass.hostControlActive
          )}
          aria-label={t('collaboration.title')}
          title={t('collaboration.title')}
          data-testid="collaboration-control"
        >
          <CollaborationIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="start"
        className="w-72"
        aria-label={t('collaboration.title')}
      >
        <section
          className="flex items-center justify-between gap-3 px-2 py-1.5 text-xs"
          aria-live="polite"
        >
          <span className="font-semibold">
            {descriptor
              ? descriptor.provider === 'p2p'
                ? 'P2P'
                : 'BYOS'
              : t('collaboration.title')}
          </span>
          <span className="text-muted-foreground">
            {statusLabel}
          </span>
        </section>

        {descriptor && (
          <div className="px-2 pb-1.5 text-[11px] text-muted-foreground">
            {t('collaboration.participants', {
              count: snapshot.peers.length + 1,
            })}
          </div>
        )}

        {descriptor && snapshot.peers.length > 0 && (
          <ul className="space-y-1 px-2 pb-1.5" aria-label={t('collaboration.peers')}>
            {snapshot.peers.map((peer) => (
              <li key={peer.clientId} className="flex items-center gap-2 text-xs">
                <span className="size-2 rounded-full" style={{ backgroundColor: peer.color }} />
                <span className="truncate">{peer.name}</span>
              </li>
            ))}
          </ul>
        )}

        <DropdownMenuSeparator />

        {!descriptor ? (
          <>
            <DropdownMenuItem
              onSelect={(event) => {
                keepOpen(event);
                start();
              }}
            >
              {t('collaboration.start.p2p')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form
              className="space-y-1.5 px-2 py-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                if (normalizedEndpoint) start(normalizedEndpoint);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Escape') event.stopPropagation();
              }}
            >
              <label
                htmlFor="collaboration-endpoint"
                className="block text-[11px] leading-4 text-muted-foreground"
              >
                {t('collaboration.byos')}
              </label>
              <div className="flex gap-1.5">
                <Input
                  id="collaboration-endpoint"
                  value={endpoint}
                  onChange={(event) => setEndpoint(event.target.value)}
                  placeholder="wss://sync.example.com"

                  className="min-w-0 flex-1"
                />
                <Button type="submit" tone="subtle" disabled={!normalizedEndpoint}>
                  {t('collaboration.connect')}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <>
            <DropdownMenuItem
              onSelect={(event) => {
                keepOpen(event);
                void copyLink();
              }}
            >
              {t('collaboration.link.copy')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(event) => {
                keepOpen(event);
                leave();
              }}
            >
              {t('collaboration.leave')}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={(event) => {
                keepOpen(event);
                void forget();
              }}
            >
              {t('collaboration.forget')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
