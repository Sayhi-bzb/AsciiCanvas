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

type CanvasSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  containerRef: RefObject<HTMLDivElement | null>;
  bgCanvasRef: RefObject<HTMLCanvasElement | null>;
  scratchCanvasRef: RefObject<HTMLCanvasElement | null>;
  uiCanvasRef: RefObject<HTMLCanvasElement | null>;
  viewportLayerRef: RefObject<HTMLDivElement | null>;
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
          className="absolute inset-0 w-full h-full block pointer-events-none"
        />
        <canvas
          ref={scratchCanvasRef}
          className="absolute inset-0 w-full h-full block pointer-events-none"
        />
        <canvas
          ref={uiCanvasRef}
          className="absolute inset-0 w-full h-full block pointer-events-none"
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
