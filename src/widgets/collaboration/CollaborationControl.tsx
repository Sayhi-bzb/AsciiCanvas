'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCanvasRuntime, useCanvasState } from '@/domains/canvas/public';
import {
  buildCollaborationUrl,
  useCollaborationRuntime,
  createCollaborationDescriptor,
  parseCollaborationUrl,
  validateCollaborationEndpoint,
} from '@/domains/collaboration/public';
import { useCollaborationSnapshot } from './useCollaborationSnapshot';
import { HOST_ICONOLOGY } from '@/shared/icons/iconology';
import { useUiI18n } from '@/shared/i18n';
import { feedback } from '@/shared/services/effects';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { Separator } from '@/shared/ui/separator';

const CollaborationIcon = HOST_ICONOLOGY.sessionAction.collaboration;
const getStatusKey = (snapshot: ReturnType<typeof useCollaborationSnapshot>) => {
  if (snapshot.documentStatus === 'restoring') return 'collaboration.status.loading-local';
  if (snapshot.documentStatus === 'incompatible' || snapshot.documentStatus === 'error') {
    return 'collaboration.status.error';
  }
  switch (snapshot.connectionStatus) {
    case 'connecting': return 'collaboration.status.connecting';
    case 'waiting-for-peer': return 'collaboration.status.waiting-for-peer';
    case 'online': return 'collaboration.status.connected';
    case 'offline': return 'collaboration.status.offline';
    default: return 'collaboration.status.idle';
  }
};

export function CollaborationControl() {
  const canvas = useCanvasRuntime();
  const collaborationRuntime = useCollaborationRuntime();
  const { t } = useUiI18n();
  const [open, setOpen] = useState(false);
  const [endpoint, setEndpoint] = useState('');
  const snapshot = useCollaborationSnapshot();
  const activeSession = useCanvasState((state) =>
    state.canvasSessions.find((session) => session.id === state.activeCanvasId)
  );
  const setCollaboration = canvas.commands.sessions.setCollaboration;
  const joinCollaboration = canvas.commands.sessions.joinCollaboration;
  const descriptor = activeSession?.collaboration;

  useEffect(() => {
    const incoming = parseCollaborationUrl();
    if (incoming.status === "valid") {
      joinCollaboration(incoming.descriptor);
    } else if (incoming.status === "unsupported") {
      feedback.error(t('collaboration.link.unsupported'));
    } else if (incoming.status === "invalid") {
      feedback.error(t('collaboration.link.invalid'));
    }
  }, [joinCollaboration, t]);

  useEffect(() => {
    if (!open) return;
    const closeOnWindowBlur = () => setOpen(false);
    window.addEventListener('blur', closeOnWindowBlur);
    return () => window.removeEventListener('blur', closeOnWindowBlur);
  }, [open]);

  const statusLabel = useMemo(
    () => t(getStatusKey(snapshot)),
    [snapshot, t]
  );

  const start = (customEndpoint?: string) => {
    if (!activeSession || activeSession.mode === "slide") return;
    try {
      const next = createCollaborationDescriptor(activeSession.mode, customEndpoint);
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
  if (activeSession?.mode === "slide") return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          tone="subtle"
          shape="square"
          size="md"
          active={Boolean(descriptor)}
          open={open}
          className="pointer-events-auto"
          aria-label={t('collaboration.title')}
          title={t('collaboration.title')}
          data-testid="collaboration-control"
        >
          <CollaborationIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-72 max-w-[calc(100vw-1.5rem)] p-[3px]"
        role="dialog"
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

        {snapshot.error && (
          <div className="px-2 pb-1.5 text-[11px] text-destructive" role="alert">
            {snapshot.error === 'Incompatible collaboration document'
              ? t('collaboration.document.incompatible')
              : snapshot.error}
          </div>
        )}

        {snapshot.integrityIssues.length > 0 && (
          <div className="px-2 pb-1.5 text-[11px] text-destructive" role="status">
            {snapshot.integrityIssues[0].reason}
          </div>
        )}

        {descriptor && snapshot.peers.length > 0 && (
          <ul className="flex flex-col gap-1 px-2 pb-1.5" aria-label={t('collaboration.peers')}>
            {snapshot.peers.map((peer) => (
              <li key={peer.clientId} className="flex items-center gap-2 text-xs">
                <span className="size-2 rounded-full" style={{ backgroundColor: peer.color }} />
                <span className="truncate">{peer.name}</span>
              </li>
            ))}
          </ul>
        )}

        <Separator className="my-1" />

        {!descriptor ? (
          <>
            <Button
              type="button"
              tone="subtle"
              size="sm"
              className="w-full justify-start"
              onClick={() => start()}
            >
              {t('collaboration.start.p2p')}
            </Button>
            <Separator className="my-1" />
            <form
              className="flex flex-col gap-1.5 px-2 py-1.5"
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
            <Button
              type="button"
              tone="subtle"
              size="sm"
              className="w-full justify-start"
              onClick={() => void copyLink()}
            >
              {t('collaboration.link.copy')}
            </Button>
            <Button
              type="button"
              tone="subtle"
              size="sm"
              className="w-full justify-start"
              onClick={leave}
            >
              {t('collaboration.leave')}
            </Button>
            <Button
              type="button"
              tone="subtle"
              destructive
              size="sm"
              className="w-full justify-start"
              onClick={() => void forget()}
            >
              {t('collaboration.forget')}
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
