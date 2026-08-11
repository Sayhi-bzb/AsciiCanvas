import { describe, expect, it, vi } from "vitest";
import type { Slide } from "@/domains/slides/public";
import { drawSlideCanvas } from "./slide-canvas-renderer";

const createCanvas = () => {
  const calls: string[] = [];
  let fillStyle = "";
  const ctx = {
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    clip: vi.fn(),
    fillRect: vi.fn((x: number, y: number, width: number, height: number) => {
      calls.push(`fillRect:${fillStyle}:${x},${y},${width},${height}`);
    }),
    fillText: vi.fn((text: string) => calls.push(`fillText:${text}`)),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    rect: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    setTransform: vi.fn(),
    stroke: vi.fn(),
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value: string) {
      fillStyle = value;
    },
    font: "",
    lineWidth: 1,
    strokeStyle: "",
    textAlign: "start" as CanvasTextAlign,
    textBaseline: "alphabetic" as CanvasTextBaseline,
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
  } as unknown as HTMLCanvasElement;
  return { calls, canvas, ctx };
};

describe("drawSlideCanvas", () => {
  it("renders the complete slide with backgrounds before text", () => {
    const { calls, canvas, ctx } = createCanvas();
    const slide: Slide = {
      id: "slide-1",
      name: "Complete slide",
      grid: [
        [
          "0,0",
          { char: "界", color: "#abcdef", bgColor: "#123456" },
        ],
        [
          "99,26",
          {
            char: "A",
            color: "#ff0000",
            bgColor: "#00ff00",
            attrs: { bold: true, underline: true },
          },
        ],
        ["100,27", { char: "X", color: "#000000" }],
      ],
    };

    const layout = drawSlideCanvas({
      canvas,
      slide,
      size: { columns: 100, rows: 27 },
      viewportWidth: 900,
      viewportHeight: 513,
      padding: 0,
      backdropColor: "#ffffff",
      dpr: 2,
    });

    expect(layout).toEqual({
      x: 0,
      y: 0,
      width: 900,
      height: 513,
      zoom: 1,
    });
    expect(canvas.width).toBe(1800);
    expect(canvas.height).toBe(1026);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 18, 19);
    expect(ctx.fillRect).toHaveBeenCalledWith(891, 494, 9, 19);
    expect(ctx.fillText).toHaveBeenCalledWith("A", 896, 504);
    expect(ctx.fillText).not.toHaveBeenCalledWith(
      "X",
      expect.any(Number),
      expect.any(Number)
    );
    expect(calls.indexOf("fillRect:#00ff00:891,494,9,19")).toBeLessThan(
      calls.indexOf("fillText:界")
    );
    expect(ctx.font).toContain("700");
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
  });

  it("does not draw when the preview has no measurable area", () => {
    const { canvas, ctx } = createCanvas();

    expect(
      drawSlideCanvas({
        canvas,
        slide: { id: "slide-1", name: "Empty", grid: [] },
        size: { columns: 80, rows: 24 },
        viewportWidth: 0,
        viewportHeight: 100,
      })
    ).toBeNull();
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
});
