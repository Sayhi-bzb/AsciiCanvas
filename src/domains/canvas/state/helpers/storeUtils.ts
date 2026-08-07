import type { EditorState } from '../interfaces';
import type { CanvasSession } from '@/domains/sessions/public';
import type { CanvasMode } from '@/domains/sessions/public';
import type { ToolType } from '../../model/tool';
import type {
  StructuredComponentInstance,
  StructuredNode,
} from '@/domains/structured-content/public';
import { sceneToGridEntries } from '@/domains/structured-content/public';
import { MIN_ZOOM, MAX_ZOOM } from '@/shared/lib/constants';
import { serializeGrid } from './snapshotHelpers';
import { normalizeStructuredComponents } from '@/domains/structured-content/public';
import { normalizeAndCloneScene } from './snapshotHelpers';
import { normalizeSessionMode } from '@/domains/sessions/public';
import {
  createSlideDeck,
  normalizeSlideDeck,
  updateSlideGrid,
  type SlideDeck,
} from '@/domains/slides/public';

export const DEFAULT_SESSION_ID = 'canvas-1';
export const DEFAULT_SESSION_NAME = 'Canvas 1';
export const DEFAULT_STRUCTURED_SESSION_ID = 'canvas-2';
export const DEFAULT_STRUCTURED_SESSION_NAME = 'Canvas 2';
export const DEFAULT_MODE = 'freeform' as const satisfies CanvasMode;
const STRUCTURED_ALLOWED_TOOLS: ToolType[] = [
  'select',
  'text',
  'box',
  'splitBox',
  'line',
  'arrowLine',
  'bg',
];

const DEFAULT_VIEWPORT = { offset: { x: 0, y: 0 }, zoom: 1 };
export const getSlideCanvasDocumentId = (sessionId: string, slideId: string) =>
  `${sessionId}:slide:${slideId}`;

export const getSessionCanvasDocumentId = (session: CanvasSession, slideDeck?: SlideDeck | null) =>
  session.mode === 'slide'
    ? getSlideCanvasDocumentId(session.id, (slideDeck ?? session.slideDeck).activeSlideId)
    : session.id;

export const normalizeSessionViewport = (viewport: CanvasSession['viewport'] | undefined) => {
  if (!viewport) return null;
  const x = Number.isFinite(viewport.offset?.x) ? viewport.offset.x : DEFAULT_VIEWPORT.offset.x;
  const y = Number.isFinite(viewport.offset?.y) ? viewport.offset.y : DEFAULT_VIEWPORT.offset.y;
  const rawZoom = Number.isFinite(viewport.zoom) ? viewport.zoom : DEFAULT_VIEWPORT.zoom;
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, rawZoom));
  return { offset: { x, y }, zoom };
};

export const isToolAllowedForMode = (tool: ToolType, mode: CanvasMode) => {
  if (mode === 'structured') return STRUCTURED_ALLOWED_TOOLS.includes(tool);
  return tool !== 'text' && tool !== 'arrowLine';
};

const getFallbackToolForMode = (mode: CanvasMode): ToolType => {
  return mode === 'structured' ? 'select' : 'brush';
};

export const buildSessionSnapshot = (state: EditorState) => {
  if (state.canvasMode === 'slide') {
    const deck =
      state.slideDeck ??
      createSlideDeck({
        initialSlideId: `${state.activeCanvasId}-slide-1`,
      });
    return {
      mode: 'slide' as const,
      slideDeck: updateSlideGrid(deck, deck.activeSlideId, serializeGrid(state.grid)),
      viewport: { offset: { ...state.offset }, zoom: state.zoom },
    };
  }
  if (state.canvasMode === 'structured') {
    return {
      mode: 'structured' as const,
      scene: state.structuredScene,
      components: state.structuredComponents,
      grid: sceneToGridEntries(state.structuredScene),
      viewport: { offset: { ...state.offset }, zoom: state.zoom },
    };
  }

  return {
    mode: 'freeform' as const,
    scene: [] as StructuredNode[],
    components: [] as StructuredComponentInstance[],
    grid: serializeGrid(state.grid),
    viewport: { offset: { ...state.offset }, zoom: state.zoom },
  };
};

export const resolveSessionRuntime = (session: CanvasSession, currentTool: ToolType) => {
  const nextMode = normalizeSessionMode(session.mode);
  const viewport = normalizeSessionViewport(session.viewport);
  const nextOffset = viewport?.offset ?? DEFAULT_VIEWPORT.offset;
  const nextZoom = viewport?.zoom ?? DEFAULT_VIEWPORT.zoom;

  const nextSlideDeck: SlideDeck | null =
    nextMode === 'slide' && session.mode === 'slide'
      ? normalizeSlideDeck(session.slideDeck, `${session.id}-slide-1`)
      : null;
  const nextScene = nextMode === 'structured' ? normalizeAndCloneScene(session.scene) : [];
  const nextComponents =
    nextMode === 'structured' ? normalizeStructuredComponents(session.components, nextScene) : [];
  const nextGridEntries =
    nextMode === 'structured'
      ? sceneToGridEntries(nextScene)
      : nextMode === 'slide' && nextSlideDeck
        ? (nextSlideDeck.slides.find((slide) => slide.id === nextSlideDeck.activeSlideId)?.grid ??
          [])
        : session.mode !== 'slide'
          ? session.grid
          : [];

  return {
    nextMode,
    nextSlideDeck,
    nextScene,
    nextComponents,
    nextGridEntries,
    nextTool: isToolAllowedForMode(currentTool, nextMode)
      ? currentTool
      : getFallbackToolForMode(nextMode),
    nextOffset,
    nextZoom,
    hasSavedViewport: !!viewport,
  };
};
