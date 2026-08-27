import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CanvasSurface } from './CanvasSurface';
import { resolveCanvasSurfaceGeometry } from './canvasSurfaceGeometry';
import { EditorPresentationProvider } from '@/widgets/editor-chrome/public';

vi.mock('./StructuredSplitToolbar', () => ({
  StructuredSplitToolbar: () => <div data-testid="selection-toolbar" />,
}));

describe('CanvasSurface', () => {
  it('composes canvas rasters without scaling host overlays or input', () => {
    const containerRef = createRef<HTMLDivElement>();
    const viewportLayerRef = createRef<HTMLDivElement>();
    const canvasRef = createRef<HTMLCanvasElement>();
    const textareaRef = createRef<HTMLTextAreaElement>();
    const surfaceGeometry = resolveCanvasSurfaceGeometry({ width: 1000, height: 700 });

    render(
      <CanvasSurface
        containerRef={containerRef}
        viewportLayerRef={viewportLayerRef}
        canvasRef={canvasRef}
        surfaceGeometry={surfaceGeometry}
        containerSize={{ width: 1000, height: 700 }}
        textareaRef={textareaRef}
        textareaStyle={{}}
        textareaProps={{ 'aria-label': 'Canvas input' }}
      >
        <div data-testid="content-overlay" />
      </CanvasSurface>
    );

    const surface = screen.getByTestId('canvas-editor-surface');
    const layer = screen.getByTestId('canvas-viewport-layer');
    expect(surface).toHaveAttribute('data-slot', 'canvas-surface');
    expect(surface).toHaveAttribute('data-onboarding-target', 'canvas');
    expect(layer).toHaveClass('absolute', 'inset-0', 'origin-top-left', 'will-change-transform');
    expect(layer.querySelectorAll(':scope > canvas')).toHaveLength(1);
    expect(layer).toContainElement(canvasRef.current);
    layer.querySelectorAll(':scope > canvas').forEach((canvas) => {
      expect(canvas).toHaveStyle({
        left: '-128px',
        top: '-128px',
        width: '1256px',
        height: '956px',
      });
    });
    expect(layer).not.toContainElement(screen.getByTestId('content-overlay'));
    expect(layer).not.toContainElement(screen.getByTestId('selection-toolbar'));
    expect(layer).not.toContainElement(screen.getByRole('textbox'));
  });

  it('keeps the canvas input but hides contextual overlays in Zen Mode', () => {
    render(
      <EditorPresentationProvider initialMode="zen">
        <CanvasSurface
          containerRef={createRef<HTMLDivElement>()}
          viewportLayerRef={createRef<HTMLDivElement>()}
          canvasRef={createRef<HTMLCanvasElement>()}
          surfaceGeometry={undefined}
          containerSize={{ width: 800, height: 600 }}
          textareaRef={createRef<HTMLTextAreaElement>()}
          textareaStyle={{}}
          textareaProps={{ 'aria-label': 'Canvas input' }}
        />
      </EditorPresentationProvider>
    );

    expect(screen.queryByTestId('selection-toolbar')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Canvas input' })).toBeInTheDocument();
  });
});
