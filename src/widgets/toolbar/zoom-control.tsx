'use client';

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCanvasRuntime, useCanvasState } from '@/domains/canvas/public';
import { HOST_ICONOLOGY } from '@/shared/icons/iconology';
import { MAX_ZOOM, MIN_ZOOM } from '@/shared/lib/constants';
import { cn } from '@/shared/lib/utils';
import { rx } from '@/shared/styles/recipes';
import { Button } from '@/shared/ui/button';
import { useUiI18n } from '@/shared/i18n';
import { feedback } from '@/shared/services/effects';
import { useCanvasEngineRuntime } from '@/widgets/canvas-editor/engine/useCanvasEngineRuntime';
import { SlidePlaybackOverlay } from './slide-playback';
import type {
  EditorFormFactor,
  EditorViewportFrame,
} from '@/widgets/editor-chrome/public';

const ZOOM_STEP = 1.2;
const ZOOM_EPSILON = 0.000001;
const ZOOM_ANIMATION_DURATION_MS = 280;
const ZoomOutIcon = HOST_ICONOLOGY.zoomAction.out;
const ZoomInIcon = HOST_ICONOLOGY.zoomAction.in;
const GridIcon = HOST_ICONOLOGY.viewportAction.grid;
const MinimapIcon = HOST_ICONOLOGY.viewportAction.minimap;
const PlayIcon = HOST_ICONOLOGY.slideAction.play;
const Minimap = lazy(() =>
  import('@/widgets/canvas-editor/Minimap').then((module) => ({
    default: module.Minimap,
  }))
);

type ZoomControlProps = {
  containerSize?: { width: number; height: number };
  viewportFrame?: EditorViewportFrame;
  formFactor?: EditorFormFactor;
};

export function ZoomControl({
  containerSize,
  viewportFrame,
  formFactor = 'desktop',
}: ZoomControlProps) {
  const canvas = useCanvasRuntime();
  const { t } = useUiI18n();
  const runtime = useCanvasEngineRuntime();
  const { zoom, canvasMode, slideDeck, showGrid } = useCanvasState(
    useShallow((state) => ({
      zoom: state.zoom,
      canvasMode: state.canvasMode,
      slideDeck: state.slideDeck,
      showGrid: state.showGrid,
    }))
  );
  const setShowGrid = canvas.commands.preferences.setShowGrid;
  const [minimapOpen, setMinimapOpen] = useState(false);
  const [playbackOpen, setPlaybackOpen] = useState(false);
  const ownsFullscreenRef = useRef(false);
  const viewportSize = viewportFrame
    ? { width: viewportFrame.width, height: viewportFrame.height }
    : containerSize;

  useEffect(
    () => () => runtime.camera.cancelAnimation(),
    [runtime]
  );

  const exitPlayback = useCallback(() => {
    setPlaybackOpen(false);
    if (!ownsFullscreenRef.current) return;
    ownsFullscreenRef.current = false;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  const startPlayback = useCallback(() => {
    if (!slideDeck) return;
    setPlaybackOpen(true);
    if (document.fullscreenElement) return;
    const requestFullscreen = document.documentElement.requestFullscreen;
    if (!requestFullscreen) {
      feedback.warning(t('slide.playback.fullscreenUnavailable'));
      return;
    }
    void requestFullscreen
      .call(document.documentElement)
      .then(() => {
        ownsFullscreenRef.current = true;
      })
      .catch(() => {
        feedback.warning(t('slide.playback.fullscreenUnavailable'));
      });
  }, [slideDeck, t]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (document.fullscreenElement || !ownsFullscreenRef.current) return;
      ownsFullscreenRef.current = false;
      setPlaybackOpen(false);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (ownsFullscreenRef.current && document.fullscreenElement) {
        ownsFullscreenRef.current = false;
        void document.exitFullscreen().catch(() => undefined);
      }
    };
  }, []);

  const animateZoomTo = useCallback(
    (requestedZoom: number) => {
      const viewportCenter = viewportFrame?.center ??
        (containerSize
          ? { x: containerSize.width / 2, y: containerSize.height / 2 }
          : undefined);
      if (!viewportCenter) return;
      const targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, requestedZoom));
      if (Math.abs(targetZoom - runtime.camera.getViewport().zoom) <= ZOOM_EPSILON) return;
      runtime.camera.animateZoomTo(
        targetZoom,
        viewportCenter,
        { duration: ZOOM_ANIMATION_DURATION_MS }
      );
    },
    [containerSize, runtime, viewportFrame]
  );

  const applyZoomDelta = useCallback(
    (deltaZoom: number) => {
      const baseZoom = runtime.camera.getTargetViewport().zoom;
      animateZoomTo(baseZoom * deltaZoom);
    },
    [animateZoomTo, runtime]
  );

  const percentage = Math.round(zoom * 100);
  const zoomLabel = `${t('zoom.label')} — ${percentage}%`;
  const isMinZoom = zoom <= MIN_ZOOM + ZOOM_EPSILON;
  const resetLabel = `${t('zoom.reset')} — ${percentage}%`;
  const isMaxZoom = zoom >= MAX_ZOOM - ZOOM_EPSILON;
  const actionsDisabled = !viewportSize;
  const gridLabel = showGrid ? t('sidebar.grid.hide') : t('action.toggleGrid');
  const minimapLabel = t('sidebar.minimap');
  const playbackLabel = t('slide.playback.start');

  if (formFactor === 'phone') return null;

  return (
    <div
      data-canvas-ui="true"
      data-testid="zoom-control"
      className={rx.toolbarShell}
      aria-label={zoomLabel}
    >
      {canvasMode !== 'slide' && minimapOpen && (
        <div
          data-testid="zoom-minimap"
          className={cn(
            rx.floatingHost,
            'absolute bottom-full left-0 z-(--layer-popover) mb-2 w-auto overflow-hidden'
          )}
        >
          <Suspense fallback={<div className="h-[140px] w-[220px] bg-muted" />}>
            <Minimap containerSize={viewportSize} />
          </Suspense>
        </div>
      )}
      <Button
        tone="subtle"
        size="md"
        className={cn(rx.hostIconControl, 'rounded-r-none')}
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
          rx.hostControl,
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
        className={cn(rx.hostIconControl, 'rounded-none')}
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
          rx.hostIconControl,
          showGrid && rx.hostControlActive,
          'rounded-none'
        )}
        aria-label={gridLabel}
        aria-pressed={showGrid}
        title={gridLabel}
        data-testid="zoom-grid"
        onClick={() => setShowGrid(!showGrid)}
      >
        <GridIcon />
      </Button>
      {canvasMode === 'slide' ? (
        <Button
          tone="subtle"
          size="md"
          className={cn(rx.hostIconControl, 'rounded-l-none')}
          aria-label={playbackLabel}
          title={playbackLabel}
          data-testid="zoom-playback"
          disabled={!slideDeck}
          onClick={startPlayback}
        >
          <PlayIcon />
        </Button>
      ) : (
        <Button
          tone="subtle"
          size="md"
          className={cn(
            rx.hostIconControl,
            minimapOpen && rx.hostControlActive,
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
      )}
      {playbackOpen && slideDeck && (
        <SlidePlaybackOverlay
          deck={slideDeck}
          initialSlideId={slideDeck.activeSlideId}
          onExit={exitPlayback}
        />
      )}
    </div>
  );
}
