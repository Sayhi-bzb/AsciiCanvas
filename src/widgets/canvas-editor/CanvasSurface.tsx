import {
  forwardRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
  type RefObject,
  type TextareaHTMLAttributes,
} from 'react';
import { SelectionFormatToolbar } from './SelectionFormatToolbar';
import type { CanvasSurfaceGeometry } from './canvasSurfaceGeometry';

type CanvasSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  containerRef: RefObject<HTMLDivElement | null>;
  bgCanvasRef: RefObject<HTMLCanvasElement | null>;
  scratchCanvasRef: RefObject<HTMLCanvasElement | null>;
  uiCanvasRef: RefObject<HTMLCanvasElement | null>;
  viewportLayerRef: RefObject<HTMLDivElement | null>;
  surfaceGeometry: CanvasSurfaceGeometry | undefined;
  containerSize: { width: number; height: number } | undefined;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  textareaStyle: CSSProperties;
  textareaProps: TextareaHTMLAttributes<HTMLTextAreaElement>;
  children?: ReactNode;
};

const assignRef = <T,>(ref: Ref<T> | undefined, value: T | null) => {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
};

export const CanvasSurface = forwardRef<HTMLDivElement, CanvasSurfaceProps>(function CanvasSurface(
  {
    containerRef,
    bgCanvasRef,
    scratchCanvasRef,
    uiCanvasRef,
    viewportLayerRef,
    surfaceGeometry,
    containerSize,
    textareaRef,
    textareaStyle,
    textareaProps,
    children,
    className,
    style,
    ...surfaceProps
  },
  forwardedRef
) {
  const canvasStyle: CSSProperties = surfaceGeometry
    ? {
        left: surfaceGeometry.left,
        top: surfaceGeometry.top,
        width: surfaceGeometry.width,
        height: surfaceGeometry.height,
      }
    : { inset: 0, width: '100%', height: '100%' };

  return (
    <div
      ref={(node) => {
        assignRef(containerRef, node);
        assignRef(forwardedRef, node);
      }}
      data-testid="ascii-canvas-surface"
      data-onboarding-target="canvas"
      style={{ touchAction: 'none', ...style }}
      className={
        className ??
        'relative w-screen h-screen overflow-hidden bg-background touch-none select-none cursor-default'
      }
      {...surfaceProps}
    >
      <div
        ref={viewportLayerRef}
        data-testid="canvas-viewport-layer"
        className="absolute inset-0 origin-top-left pointer-events-none will-change-transform"
      >
        <canvas
          ref={bgCanvasRef}
          className="absolute block pointer-events-none"
          style={canvasStyle}
        />
        <canvas
          ref={scratchCanvasRef}
          className="absolute block pointer-events-none"
          style={canvasStyle}
        />
        <canvas
          ref={uiCanvasRef}
          className="absolute block pointer-events-none"
          style={canvasStyle}
        />
      </div>
      {children}
      <SelectionFormatToolbar containerSize={containerSize} />
      <textarea
        ref={textareaRef}
        data-canvas-managed-input="true"
        style={textareaStyle}
        {...textareaProps}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
    </div>
  );
});
