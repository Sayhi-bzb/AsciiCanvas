import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CanvasSurface } from './CanvasSurface';

vi.mock('./SelectionFormatToolbar', () => ({
  SelectionFormatToolbar: () => <div data-testid="selection-toolbar" />,
}));

describe('CanvasSurface', () => {
  it('composes canvas rasters without scaling host overlays or input', () => {
    const containerRef = createRef<HTMLDivElement>();
    const viewportLayerRef = createRef<HTMLDivElement>();
    const bgCanvasRef = createRef<HTMLCanvasElement>();
    const scratchCanvasRef = createRef<HTMLCanvasElement>();
    const uiCanvasRef = createRef<HTMLCanvasElement>();
    const textareaRef = createRef<HTMLTextAreaElement>();

    render(
      <CanvasSurface
        containerRef={containerRef}
        viewportLayerRef={viewportLayerRef}
        bgCanvasRef={bgCanvasRef}
        scratchCanvasRef={scratchCanvasRef}
        uiCanvasRef={uiCanvasRef}
        containerSize={{ width: 1000, height: 700 }}
        textareaRef={textareaRef}
        textareaStyle={{}}
        textareaProps={{ 'aria-label': 'Canvas input' }}
      >
        <div data-testid="content-overlay" />
      </CanvasSurface>
    );

    const layer = screen.getByTestId('canvas-viewport-layer');
    expect(layer).toHaveClass('absolute', 'inset-0', 'origin-top-left', 'will-change-transform');
    expect(layer.querySelectorAll(':scope > canvas')).toHaveLength(3);
    expect(layer).toContainElement(bgCanvasRef.current);
    expect(layer).toContainElement(scratchCanvasRef.current);
    expect(layer).toContainElement(uiCanvasRef.current);
    expect(layer).not.toContainElement(screen.getByTestId('content-overlay'));
    expect(layer).not.toContainElement(screen.getByTestId('selection-toolbar'));
    expect(layer).not.toContainElement(screen.getByRole('textbox'));
  });
});
