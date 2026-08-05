"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Slide, SlideDeck } from "@/domains/slides/public";
import { HOST_ICONOLOGY } from "@/shared/icons/iconology";
import { useUiI18n } from "@/shared/i18n";
import { CELL_HEIGHT, CELL_WIDTH } from "@/shared/lib/constants";
import {
  drawCellBackground,
  drawCellText,
  prepareCanvasSurface,
} from "@/shared/metrics";
import { SHORTCUT_PRIORITY, useShortcutLayer } from "@/shared/shortcuts/dispatcher";
import { GridManager } from "@/shared/utils/grid";
import { Button } from "@/shared/ui/button";
import { resolveSlidePlaybackIndex, resolveSlidePlaybackLayout } from "./slide-playback-model";

const PreviousIcon = HOST_ICONOLOGY.slideAction.previous;
const NextIcon = HOST_ICONOLOGY.slideAction.next;
const CloseIcon = HOST_ICONOLOGY.slideAction.close;


const drawSlide = (
  canvas: HTMLCanvasElement,
  slide: Slide,
  deck: SlideDeck,
  viewportWidth: number,
  viewportHeight: number
) => {
  const ctx = canvas.getContext("2d");
  if (!ctx || viewportWidth <= 0 || viewportHeight <= 0) return;
  const dpr = window.devicePixelRatio || 1;
  prepareCanvasSurface(canvas, ctx, viewportWidth, viewportHeight, dpr);
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  const layout = resolveSlidePlaybackLayout({
    viewportWidth,
    viewportHeight,
    columns: deck.size.columns,
    rows: deck.size.rows,
  });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(layout.x, layout.y, layout.width, layout.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(layout.x, layout.y, layout.width, layout.height);
  ctx.clip();

  const cells = slide.grid.map(([key, cell]) => ({
    ...GridManager.fromKey(key),
    cell,
  }));
  cells.forEach(({ x, y, cell }) => {
    if (x < 0 || x >= deck.size.columns || y < 0 || y >= deck.size.rows) return;
    drawCellBackground(
      ctx,
      cell,
      layout.x + x * CELL_WIDTH * layout.zoom,
      layout.y + y * CELL_HEIGHT * layout.zoom,
      { zoom: layout.zoom }
    );
  });
  cells.forEach(({ x, y, cell }) => {
    if (x < 0 || x >= deck.size.columns || y < 0 || y >= deck.size.rows) return;
    if (cell.char === " " && !cell.attrs) return;
    drawCellText(
      ctx,
      cell,
      layout.x + x * CELL_WIDTH * layout.zoom,
      layout.y + y * CELL_HEIGHT * layout.zoom,
      { zoom: layout.zoom }
    );
  });
  ctx.restore();
};

export function SlidePlaybackOverlay({
  deck,
  initialSlideId,
  onExit,
}: {
  deck: SlideDeck;
  initialSlideId: string;
  onExit: () => void;
}) {
  const { t } = useUiI18n();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const initialIndex = Math.max(
    0,
    deck.slides.findIndex((slide) => slide.id === initialSlideId)
  );
  const [slideIndex, setSlideIndex] = useState(initialIndex);
  const slide = deck.slides[slideIndex] ?? deck.slides[0];
  const isFirst = slideIndex === 0;
  const isLast = slideIndex === deck.slides.length - 1;

  const navigate = useCallback(
    (command: "previous" | "next" | "first" | "last") => {
      setSlideIndex((current) =>
        resolveSlidePlaybackIndex(current, command, deck.slides.length)
      );
    },
    [deck.slides.length]
  );

  useShortcutLayer({
    id: "slide-playback",
    priority: SHORTCUT_PRIORITY.presentation,
    onKeyDown: (event) => {
      if (
        event.key === "ArrowRight" ||
        event.key === "ArrowDown" ||
        event.key === "PageDown" ||
        event.key === " " ||
        event.key === "Enter"
      ) {
        navigate("next");
      } else if (
        event.key === "ArrowLeft" ||
        event.key === "ArrowUp" ||
        event.key === "PageUp"
      ) {
        navigate("previous");
      } else if (event.key === "Home") {
        navigate("first");
      } else if (event.key === "End") {
        navigate("last");
      } else if (event.key === "Escape") {
        onExit();
      }
      return { claimed: true, preventDefault: true };
    },
  });

  useEffect(() => {
    hostRef.current?.focus();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas || !slide) return;
    const render = () =>
      drawSlide(canvas, slide, deck, host.clientWidth, host.clientHeight);
    render();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(render);
    observer?.observe(host);
    window.addEventListener("resize", render);
    document.fonts?.addEventListener("loadingdone", render);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", render);
      document.fonts?.removeEventListener("loadingdone", render);
    };
  }, [deck, slide]);

  const pageLabel = useMemo(
    () =>
      t("slide.playback.page", {
        current: slideIndex + 1,
        total: deck.slides.length,
      }),
    [deck.slides.length, slideIndex, t]
  );

  if (!slide || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={hostRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("slide.playback.title")}
      tabIndex={-1}
      data-testid="slide-playback"
      className="fixed inset-0 z-[100] overflow-hidden bg-slate-900 outline-none"
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={slide.name}
        className="absolute inset-0 block size-full"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          navigate(event.clientX < rect.left + rect.width / 2 ? "previous" : "next");
        }}
      />
      <div
        data-canvas-ui="true"
        className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-white/15 bg-black/70 p-1.5 text-white shadow-2xl backdrop-blur"
      >
        <Button
          tone="subtle"
          shape="square"
          size="md"
          className="text-white hover:bg-white/15 hover:text-white"
          aria-label={t("slide.playback.previous")}
          disabled={isFirst}
          onClick={() => navigate("previous")}
        >
          <PreviousIcon />
        </Button>
        <span className="min-w-20 px-2 text-center text-xs tabular-nums" aria-live="polite">
          {pageLabel}
        </span>
        <Button
          tone="subtle"
          shape="square"
          size="md"
          className="text-white hover:bg-white/15 hover:text-white"
          aria-label={t("slide.playback.next")}
          disabled={isLast}
          onClick={() => navigate("next")}
        >
          <NextIcon />
        </Button>
        <span className="mx-1 h-5 w-px bg-white/20" aria-hidden="true" />
        <Button
          tone="subtle"
          shape="square"
          size="md"
          className="text-white hover:bg-white/15 hover:text-white"
          aria-label={t("slide.playback.exit")}
          onClick={onExit}
        >
          <CloseIcon />
        </Button>
      </div>
    </div>,
    document.body
  );
}
