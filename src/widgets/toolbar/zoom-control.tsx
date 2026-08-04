'use client';

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '@/domains/canvas/public';
import { runSidebarAction } from '@/domains/actions/public';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { HOST_ICONOLOGY } from '@/shared/icons/iconology';
import { MAX_ZOOM, MIN_ZOOM } from '@/shared/lib/constants';
import { cn } from '@/shared/lib/utils';
import { uiClass } from '@/shared/styles/components';
import { Button } from '@/shared/ui/button';
import { useUiI18n } from '@/shared/i18n';
import { createViewportInteractionController } from '@/widgets/canvas-editor/hooks/interaction/viewport/viewportInteractionController';

const ZOOM_STEP = 1.2;
const ZOOM_EPSILON = 0.000001;
const ZOOM_ANIMATION_DURATION_MS = 280;
const ZoomOutIcon = HOST_ICONOLOGY.zoomAction.out;
const ZoomInIcon = HOST_ICONOLOGY.zoomAction.in;
const GridIcon = HOST_ICONOLOGY.viewportAction.grid;
const MinimapIcon = HOST_ICONOLOGY.viewportAction.minimap;
const Minimap = lazy(() =>
  import('@/widgets/canvas-editor/Minimap').then((module) => ({
    default: module.Minimap,
  }))
);

type ZoomControlProps = {
  containerSize: { width: number; height: number } | undefined;
};

export function ZoomControl({ containerSize }: ZoomControlProps) {
  const isMobile = useIsMobile();
  const { t } = useUiI18n();
  const { zoom, showGrid, setShowGrid, setOffset, setZoom } = useEditorStore(
    useShallow((state) => ({
      zoom: state.zoom,
      showGrid: state.showGrid,
      setShowGrid: state.setShowGrid,
      setOffset: state.setOffset,
      setZoom: state.setZoom,
    }))
  );
  const [minimapOpen, setMinimapOpen] = useState(false);
  const zoomAnimationRef = useRef<{
    frameId: number;
    targetZoom: number;
  } | null>(null);

  const viewportInteraction = useMemo(
    () =>
      createViewportInteractionController({
        setOffset,
        setZoom,
        zoomBounds: { min: MIN_ZOOM, max: MAX_ZOOM },
      }),
    [setOffset, setZoom]
  );

  useEffect(
    () => () => {
      if (zoomAnimationRef.current) {
        window.cancelAnimationFrame(zoomAnimationRef.current.frameId);
        zoomAnimationRef.current = null;
      }
      viewportInteraction.cancel();
    },
    [viewportInteraction]
  );

  const animateZoomTo = useCallback(
    (requestedZoom: number) => {
      if (!containerSize) return;

      if (zoomAnimationRef.current) {
        window.cancelAnimationFrame(zoomAnimationRef.current.frameId);
        zoomAnimationRef.current = null;
      }

      const startZoom = useEditorStore.getState().zoom;
      const targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, requestedZoom));
      if (Math.abs(targetZoom - startZoom) <= ZOOM_EPSILON) return;

      const applyZoom = (nextZoom: number) => {
        const currentZoom = useEditorStore.getState().zoom;
        if (Math.abs(nextZoom - currentZoom) <= ZOOM_EPSILON) return;
        viewportInteraction.queueZoomDelta(
          nextZoom / currentZoom,
          containerSize.width / 2,
          containerSize.height / 2
        );
        viewportInteraction.flushZoom();
      };

      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        applyZoom(targetZoom);
        return;
      }

      const startedAt = performance.now();
      const tick = (timestamp: number) => {
        const progress = Math.min(
          1,
          Math.max(0, (timestamp - startedAt) / ZOOM_ANIMATION_DURATION_MS)
        );
        const easedProgress =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        applyZoom(startZoom + (targetZoom - startZoom) * easedProgress);

        if (progress < 1) {
          const frameId = window.requestAnimationFrame(tick);
          zoomAnimationRef.current = { frameId, targetZoom };
        } else {
          zoomAnimationRef.current = null;
        }
      };

      const frameId = window.requestAnimationFrame(tick);
      zoomAnimationRef.current = { frameId, targetZoom };
    },
    [containerSize, viewportInteraction]
  );

  const applyZoomDelta = useCallback(
    (deltaZoom: number) => {
      const baseZoom = zoomAnimationRef.current?.targetZoom ?? useEditorStore.getState().zoom;
      animateZoomTo(baseZoom * deltaZoom);
    },
    [animateZoomTo]
  );

  const percentage = Math.round(zoom * 100);
  const zoomLabel = `${t('zoom.label')} — ${percentage}%`;
  const isMinZoom = zoom <= MIN_ZOOM + ZOOM_EPSILON;
  const resetLabel = `${t('zoom.reset')} — ${percentage}%`;
  const isMaxZoom = zoom >= MAX_ZOOM - ZOOM_EPSILON;
  const actionsDisabled = !containerSize;
  const gridLabel = showGrid ? t('sidebar.grid.hide') : t('action.toggleGrid');
  const minimapLabel = t('sidebar.minimap');

  if (isMobile) return null;

  return (
    <div
      data-canvas-ui="true"
      data-testid="zoom-control"
      className={cn(uiClass.toolbarShell, 'fixed bottom-3 left-3 z-50')}
      aria-label={zoomLabel}
    >
      {minimapOpen && (
        <div
          data-testid="zoom-minimap"
          className={cn(
            uiClass.floatingHost,
            'absolute bottom-full left-0 z-40 mb-2 w-auto overflow-hidden'
          )}
        >
          <Suspense fallback={<div className="h-[140px] w-[220px] bg-muted" />}>
            <Minimap containerSize={containerSize} />
          </Suspense>
        </div>
      )}
      <Button
        tone="subtle"
        size="md"
        className={cn(uiClass.hostIconControl, 'rounded-r-none')}
        aria-label={t('zoom.out')}
        title={t('zoom.out')}
        data-testid="zoom-out"
        disabled={actionsDisabled || isMinZoom}
        onClick={() => applyZoomDelta(1 / ZOOM_STEP)}
      >
        <ZoomOutIcon />
      </Button>
      <Button
        tone="subtle"
        size="md"
        className={cn(
          uiClass.hostControl,
          'h-8 min-w-14 rounded-none border-0 px-2 text-xs tabular-nums shadow-none'
        )}
        aria-label={resetLabel}
        title={resetLabel}
        data-testid="zoom-reset"
        disabled={actionsDisabled}
        onClick={() => animateZoomTo(1)}
      >
        {percentage}%
      </Button>
      <Button
        tone="subtle"
        size="md"
        className={cn(uiClass.hostIconControl, 'rounded-none')}
        aria-label={t('zoom.in')}
        title={t('zoom.in')}
        data-testid="zoom-in"
        disabled={actionsDisabled || isMaxZoom}
        onClick={() => applyZoomDelta(ZOOM_STEP)}
      >
        <ZoomInIcon />
      </Button>
      <Button
        tone="subtle"
        size="md"
        className={cn(
          uiClass.hostIconControl,
          showGrid && uiClass.hostControlActive,
          'rounded-none'
        )}
        aria-label={gridLabel}
        aria-pressed={showGrid}
        title={gridLabel}
        data-testid="zoom-grid"
        onClick={() =>
          runSidebarAction('toggle-grid', {
            showGrid,
            setShowGrid,
            setZoom,
            setOffset,
          })
        }
      >
        <GridIcon />
      </Button>
      {
        <Button
          tone="subtle"
          size="md"
          className={cn(
            uiClass.hostIconControl,
            minimapOpen && uiClass.hostControlActive,
            'rounded-l-none'
          )}
          aria-label={minimapLabel}
          aria-pressed={minimapOpen}
          title={minimapLabel}
          data-testid="zoom-minimap-toggle"
          disabled={actionsDisabled}
          onClick={() => setMinimapOpen((open) => !open)}
        >
          <MinimapIcon />
        </Button>
      }
    </div>
  );
}
