import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Slide } from "@/domains/slides/public";
import { SlidePreviewCanvas } from "./slide-preview-canvas";

const { drawSlideCanvas } = vi.hoisted(() => ({
  drawSlideCanvas: vi.fn(),
}));

vi.mock("./slide-canvas-renderer", () => ({ drawSlideCanvas }));

const slide: Slide = {
  id: "slide-1",
  name: "Preview",
  grid: [],
};

describe("SlidePreviewCanvas", () => {
  let resize: ResizeObserverCallback;
  const disconnect = vi.fn();
  const observe = vi.fn();
  const fonts = new EventTarget();
  const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts");

  beforeEach(() => {
    drawSlideCanvas.mockReset();
    disconnect.mockReset();
    observe.mockReset();
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 103,
      height: 103,
      left: 0,
      right: 180,
      top: 0,
      width: 180,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: class ResizeObserverMock {
        constructor(callback: ResizeObserverCallback) {
          resize = callback;
        }
        observe = observe;
        disconnect = disconnect;
        unobserve = vi.fn();
      },
    });
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: fonts,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, "ResizeObserver");
    if (originalFonts) {
      Object.defineProperty(document, "fonts", originalFonts);
    } else {
      Reflect.deleteProperty(document, "fonts");
    }
  });

  it("redraws for content, size, element resize, and font changes", () => {
    const { rerender, unmount } = render(
      <SlidePreviewCanvas slide={slide} size={{ columns: 100, rows: 27 }} />
    );

    expect(drawSlideCanvas).toHaveBeenLastCalledWith(
      expect.objectContaining({
        slide,
        size: { columns: 100, rows: 27 },
        viewportWidth: 180,
        viewportHeight: 103,
        padding: 0,
      })
    );
    expect(observe).toHaveBeenCalledTimes(1);

    act(() => resize([], {} as ResizeObserver));
    act(() => fonts.dispatchEvent(new Event("loadingdone")));
    expect(drawSlideCanvas).toHaveBeenCalledTimes(3);

    const updatedSlide = {
      ...slide,
      grid: [["99,26", { char: "A", color: "#000000" }]] as Slide["grid"],
    };
    rerender(
      <SlidePreviewCanvas
        slide={updatedSlide}
        size={{ columns: 80, rows: 24 }}
      />
    );
    expect(drawSlideCanvas).toHaveBeenCalledTimes(4);
    expect(disconnect).toHaveBeenCalledTimes(1);

    unmount();
    expect(disconnect).toHaveBeenCalledTimes(2);
    act(() => fonts.dispatchEvent(new Event("loadingdone")));
    expect(drawSlideCanvas).toHaveBeenCalledTimes(4);
  });
});
