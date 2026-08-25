import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CellPlaneIndex, type CellPlaneOperation } from "@/domains/canvas/public";
import { MinimapManager } from "./MinimapManager";

class MockPath2D {
  rect = vi.fn();
}

const createContext = () => ({
  beginPath: vi.fn(),
  fill: vi.fn(),
  fillRect: vi.fn(),
  rect: vi.fn(),
  resetTransform: vi.fn(),
  roundRect: vi.fn(),
  setTransform: vi.fn(),
  stroke: vi.fn(),
  fillStyle: "",
  strokeStyle: "",
  globalAlpha: 1,
  lineWidth: 1,
});

const operation = (id: string, x: number): CellPlaneOperation => ({
  id,
  bounds: { x, y: 0, width: 1, height: 1 },
  rows: [{
    y: 0,
    erase: [],
    spans: [{ x, text: id, color: "#fff" }],
  }],
});

describe("MinimapManager incremental content", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("Path2D", MockPath2D);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rebuilds only chunks touched since the cached revision", () => {
    const canvas = document.createElement("canvas");
    const context = createContext();
    vi.spyOn(canvas, "getContext").mockReturnValue(
      context as unknown as CanvasRenderingContext2D
    );
    const plane = new CellPlaneIndex([operation("A", 0)]);
    const rows = vi.spyOn(plane, "rows");
    const manager = new MinimapManager(
      canvas,
      document.createElement("div"),
      { width: 220, height: 140 },
      4
    );
    const viewport = {
      reader: plane,
      offset: { x: 0, y: 0 },
      zoom: 1,
      viewportSize: { width: 1000, height: 700 },
    };
    manager.update({ ...viewport, contentRevision: plane.getRevision() });
    rows.mockClear();

    plane.append(operation("B", 200));
    manager.update({ ...viewport, contentRevision: plane.getRevision() });
    vi.advanceTimersByTime(50);

    expect(rows).toHaveBeenCalledTimes(1);
    expect(rows).toHaveBeenCalledWith({
      x: 128,
      y: 0,
      width: 128,
      height: 64,
    });
    manager.close();
  });
});
