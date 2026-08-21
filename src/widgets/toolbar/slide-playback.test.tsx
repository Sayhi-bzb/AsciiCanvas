import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShortcutProvider } from "@/shared/shortcuts/dispatcher";
import { useEditorShortcutLayer } from "@/domains/editor/public";
import type { SlideDeck } from "@/domains/slides/public";
import { SlidePlaybackOverlay } from "./slide-playback";
import {
  resolveSlidePlaybackIndex,
  resolveSlidePlaybackLayout,
} from "./slide-playback-model";

const deck: SlideDeck = {
  activeSlideId: "slide-2",
  slides: [
    {
      id: "slide-1",
      name: "First",
      size: { columns: 100, rows: 27 },
      grid: [],
    },
    {
      id: "slide-2",
      name: "Second",
      size: { columns: 80, rows: 24 },
      grid: [],
    },
  ],
};

function EditorShortcutTestLayer() {
  useEditorShortcutLayer();
  return null;
}

describe("Slide playback", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("fits the finite slide into the viewport without changing its ratio", () => {
    const layout = resolveSlidePlaybackLayout({
      viewportWidth: 1000,
      viewportHeight: 600,
      columns: 100,
      rows: 27,
      padding: 0,
    });

    expect(layout.x).toBeCloseTo(0);
    expect(layout.y).toBeCloseTo(15);
    expect(layout.width).toBeCloseTo(1000);
    expect(layout.height).toBeCloseTo(570);
  });

  it("clamps manual navigation at the first and last slides", () => {
    expect(resolveSlidePlaybackIndex(0, "previous", 2)).toBe(0);
    expect(resolveSlidePlaybackIndex(0, "next", 2)).toBe(1);
    expect(resolveSlidePlaybackIndex(1, "next", 2)).toBe(1);
    expect(resolveSlidePlaybackIndex(1, "first", 2)).toBe(0);
    expect(resolveSlidePlaybackIndex(0, "last", 2)).toBe(1);
  });

  it("starts from the selected slide and routes presentation shortcuts", () => {
    const onExit = vi.fn();
    render(
      <ShortcutProvider>
        <EditorShortcutTestLayer />
        <SlidePlaybackOverlay
          deck={deck}
          initialSlideId="slide-2"
          onExit={onExit}
        />
      </ShortcutProvider>
    );

    expect(screen.getByRole("img", { name: "Second" })).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="slide-playback-separator"]')
    ).toHaveClass("w-0.5", "rounded-full", "bg-presentation-separator");

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByRole("img", { name: "First" })).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "End" });
    expect(screen.getByRole("img", { name: "Second" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("uses the left and right canvas halves for manual navigation", () => {
    render(
      <ShortcutProvider>
        <SlidePlaybackOverlay
          deck={deck}
          initialSlideId="slide-1"
          onExit={vi.fn()}
        />
      </ShortcutProvider>
    );
    const canvas = screen.getByRole("img", { name: "First" });
    expect(canvas).toHaveClass("cursor-pointer");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 1000,
      height: 600,
      right: 1000,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.click(canvas, { clientX: 750 });
    expect(screen.getByRole("img", { name: "Second" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("img", { name: "Second" }), { clientX: 250 });
    expect(screen.getByRole("img", { name: "First" })).toBeInTheDocument();
  });
});
